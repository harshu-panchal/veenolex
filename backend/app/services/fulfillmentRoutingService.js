import Product from "../models/product.js";
import Setting from "../models/setting.js";
import Admin from "../models/admin.js";
import { getNearbySellerIdsForCustomer } from "./customerVisibilityService.js";
import {
  PRODUCT_APPROVAL_STATUS,
  resolveProductApprovalStatus,
} from "./productModerationService.js";

/**
 * Location-based fulfilment routing.
 *
 * Customers order admin master products. At checkout each line is routed to
 * the nearest local seller (a seller whose service radius covers the
 * customer) holding enough stock of their clone of that master. Lines no
 * local seller can cover are fulfilled by the admin warehouse from the
 * master product's own stock.
 */

export const ADMIN_FULFILLER = "ADMIN";

export const ROUTED_REASON = {
  LOCAL_SELLER: "LOCAL_SELLER",
  NO_LOCAL_SELLER: "NO_LOCAL_SELLER",
  LOCAL_SELLER_NO_STOCK: "LOCAL_SELLER_NO_STOCK",
  SELLER_REJECTED: "SELLER_REJECTED",
  SELLER_TIMEOUT: "SELLER_TIMEOUT",
};

const WAREHOUSE_CACHE_MS = 60 * 1000;
let warehouseCache = { value: null, at: 0 };

function isValidCoordinate(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

export function invalidateWarehouseCache() {
  warehouseCache = { value: null, at: 0 };
}

/**
 * Resolve the admin fulfilment warehouse. Settings take precedence; the
 * first admin profile with a configured location is the fallback.
 */
export async function getFulfillmentWarehouse() {
  if (warehouseCache.value && Date.now() - warehouseCache.at < WAREHOUSE_CACHE_MS) {
    return warehouseCache.value;
  }

  const settings = await Setting.findOne({}).select("fulfillmentWarehouse").lean();
  const configured = settings?.fulfillmentWarehouse || {};

  let lat = Number(configured.lat);
  let lng = Number(configured.lng);
  let address = configured.address || "";
  let serviceRadiusKm = Number(configured.serviceRadiusKm) || 10;

  if (!isValidCoordinate(lat, lng)) {
    const admins = await Admin.find({ "location.coordinates": { $exists: true } })
      .select("location address serviceRadius")
      .sort({ createdAt: 1 })
      .lean();
    const admin = admins.find((a) => {
      const [aLng, aLat] = a?.location?.coordinates || [];
      return isValidCoordinate(Number(aLat), Number(aLng));
    });
    if (admin) {
      lng = Number(admin.location.coordinates[0]);
      lat = Number(admin.location.coordinates[1]);
      address = address || admin.address || "";
      if (!configured.serviceRadiusKm && admin.serviceRadius) {
        serviceRadiusKm = Number(admin.serviceRadius);
      }
    } else {
      lat = null;
      lng = null;
    }
  }

  const timeoutMinutes = Number(configured.adminAcceptTimeoutMinutes) || 10;
  const value = {
    name: configured.name || "Veenolex Warehouse",
    address,
    city: configured.city || "",
    state: configured.state || "",
    pincode: configured.pincode || "",
    phone: configured.phone || "",
    lat,
    lng,
    hasLocation: isValidCoordinate(lat, lng),
    serviceRadiusKm,
    shiprocketPickupLocation: configured.shiprocketPickupLocation || "",
    adminAcceptTimeoutMs: timeoutMinutes * 60 * 1000,
    localDeliveryMaxHours: Number(configured.localDeliveryMaxHours) || 24,
    standardDeliveryDaysMin: Number(configured.standardDeliveryDaysMin) || 1,
    standardDeliveryDaysMax: Number(configured.standardDeliveryDaysMax) || 3,
    packageWeightKg: Number(configured.packageWeightKg) || 0.5,
  };

  warehouseCache = { value, at: Date.now() };
  return value;
}

/** Admin master id for a product: its own id (master) or the clone's master. */
export function resolveMasterProductId(product) {
  if (!product) return null;
  if (product.adminProductId) return String(product.adminProductId);
  if (!product.sellerId) return String(product._id);
  return null; // seller-owned product, not part of the admin catalog
}

function findVariant(product, variantSku) {
  const sku = String(variantSku || "").trim();
  if (!sku) return null;
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  return (
    variants.find((v) => String(v?.sku || "").trim() === sku) ||
    variants.find((v) => String(v?.name || "").trim() === sku) ||
    null
  );
}

/**
 * Units a product can sell. For a variant this is the lower of the variant
 * and product-level stock: sellers adjust the product-level number, so it
 * is the one they (and the customer catalog) treat as the truth.
 */
export function availableStockFor(product, variantSku) {
  if (!product) return 0;
  const productStock = Math.max(0, Number(product.stock || 0));
  if (String(variantSku || "").trim()) {
    const variant = findVariant(product, variantSku);
    return variant ? Math.min(Math.max(0, Number(variant.stock || 0)), productStock) : 0;
  }
  return productStock;
}

function isSellable(product) {
  return (
    product &&
    product.status === "active" &&
    resolveProductApprovalStatus(product) === PRODUCT_APPROVAL_STATUS.APPROVED
  );
}

async function getLocalSellerIds(customerLocation) {
  const lat = Number(customerLocation?.lat);
  const lng = Number(customerLocation?.lng);
  if (!isValidCoordinate(lat, lng)) return [];
  // Ordered nearest-first ($near).
  const ids = await getNearbySellerIdsForCustomer(lat, lng);
  return (ids || []).map(String);
}

/**
 * Route admin-catalog lines to local sellers or the admin warehouse.
 *
 * @param {Object} params
 * @param {Array<{masterId:string, variantSku?:string, quantity:number}>} params.lines
 * @param {{lat:number,lng:number}|null} params.customerLocation
 * @param {string[]} [params.preferredSellerIds] tried first when they are local
 * @param {string[]} [params.excludeSellerIds] never chosen (e.g. already rejected)
 * @param {boolean} [params.requireSingleSeller] all lines must go to one seller or none
 * @returns {Promise<Array<{fulfilledBy:"SELLER"|"ADMIN", sellerId:string|null, productId:string, reason:string}>>}
 */
export async function routeMasterLines({
  lines = [],
  customerLocation = null,
  preferredSellerIds = [],
  excludeSellerIds = [],
  requireSingleSeller = false,
  session = null,
}) {
  const toAdmin = (line, reason) => ({
    fulfilledBy: ADMIN_FULFILLER,
    sellerId: null,
    productId: String(line.masterId),
    reason,
  });

  if (!lines.length) return [];

  const excluded = new Set(excludeSellerIds.map(String));
  const nearby = (await getLocalSellerIds(customerLocation)).filter((id) => !excluded.has(id));
  if (!nearby.length) {
    return lines.map((line) => toAdmin(line, ROUTED_REASON.NO_LOCAL_SELLER));
  }

  const preferred = preferredSellerIds.map(String).filter((id) => nearby.includes(id));
  const candidates = [...new Set([...preferred, ...nearby])];

  const masterIds = [...new Set(lines.map((line) => String(line.masterId)))];
  const cloneQuery = Product.find({
    adminProductId: { $in: masterIds },
    sellerId: { $in: candidates },
  })
    .select("_id adminProductId sellerId stock variants status approvalStatus")
    .lean();
  if (session) cloneQuery.session(session);
  const clones = (await cloneQuery).filter(isSellable);

  const cloneBySellerMaster = new Map(
    clones.map((clone) => [`${clone.sellerId}:${clone.adminProductId}`, clone]),
  );

  // Quantity per (master, variant) so duplicate lines are checked together.
  const demand = new Map();
  lines.forEach((line) => {
    const key = `${line.masterId}:${String(line.variantSku || "").trim()}`;
    demand.set(key, (demand.get(key) || 0) + Number(line.quantity || 0));
  });

  const sellerCovers = (sellerId, line) => {
    const clone = cloneBySellerMaster.get(`${sellerId}:${line.masterId}`);
    if (!clone) return false;
    const key = `${line.masterId}:${String(line.variantSku || "").trim()}`;
    return availableStockFor(clone, line.variantSku) >= demand.get(key);
  };

  const result = new Array(lines.length).fill(null);
  const assign = (sellerId, index) => {
    const line = lines[index];
    result[index] = {
      fulfilledBy: "SELLER",
      sellerId,
      productId: String(cloneBySellerMaster.get(`${sellerId}:${line.masterId}`)._id),
      reason: ROUTED_REASON.LOCAL_SELLER,
    };
  };

  if (requireSingleSeller) {
    const seller = candidates.find((sid) => lines.every((line) => sellerCovers(sid, line)));
    if (seller) {
      lines.forEach((_, index) => assign(seller, index));
      return result;
    }
    return lines.map((line) => toAdmin(line, ROUTED_REASON.LOCAL_SELLER_NO_STOCK));
  }

  // Greedy cover: repeatedly pick the seller covering the most unassigned
  // lines (nearest wins ties) so a cart splits into as few orders as possible.
  let unassigned = lines.map((_, index) => index);
  while (unassigned.length) {
    let bestSeller = null;
    let bestCovered = [];
    for (const sellerId of candidates) {
      const covered = unassigned.filter((index) => sellerCovers(sellerId, lines[index]));
      if (covered.length > bestCovered.length) {
        bestSeller = sellerId;
        bestCovered = covered;
      }
    }
    if (!bestSeller) break;
    bestCovered.forEach((index) => assign(bestSeller, index));
    unassigned = unassigned.filter((index) => !bestCovered.includes(index));
  }

  unassigned.forEach((index) => {
    result[index] = toAdmin(lines[index], ROUTED_REASON.LOCAL_SELLER_NO_STOCK);
  });
  return result;
}

/**
 * Customer catalog: annotate admin master products with local availability.
 * `stock` becomes admin warehouse stock + stock held by local sellers so the
 * card is orderable whenever either can fulfil it.
 */
export async function annotateMasterAvailability(products = [], nearbySellerIds = []) {
  const masters = products.filter((p) => p && !p.sellerId);
  if (!masters.length) return products;

  const localStockByMaster = new Map();
  if (nearbySellerIds.length) {
    const clones = await Product.find({
      adminProductId: { $in: masters.map((p) => p._id) },
      sellerId: { $in: nearbySellerIds },
      status: "active",
      stock: { $gt: 0 },
    })
      .select("adminProductId stock")
      .lean();
    clones.forEach((clone) => {
      const key = String(clone.adminProductId);
      localStockByMaster.set(key, (localStockByMaster.get(key) || 0) + Number(clone.stock || 0));
    });
  }

  return products.map((product) => {
    if (!product || product.sellerId) return product;
    const localStock = localStockByMaster.get(String(product._id)) || 0;
    const fromLocalSeller = localStock > 0;
    return {
      ...product,
      stock: Number(product.stock || 0) + localStock,
      warehouseStock: Number(product.stock || 0),
      localStock,
      isInZone: true,
      fulfillmentSource: fromLocalSeller ? "LOCAL_SELLER" : "ADMIN",
      deliveryMethod: fromLocalSeller ? "SELLER_DIRECT" : "ADMIN_WAREHOUSE",
      estimatedDeliveryTime: fromLocalSeller ? "2-3 hours" : "1-3 days",
      deliveryBadge: fromLocalSeller ? "Fast delivery from a local store" : "Delivered by Veenolex",
    };
  });
}

export default {
  ADMIN_FULFILLER,
  ROUTED_REASON,
  getFulfillmentWarehouse,
  invalidateWarehouseCache,
  resolveMasterProductId,
  availableStockFor,
  routeMasterLines,
  annotateMasterAvailability,
};
