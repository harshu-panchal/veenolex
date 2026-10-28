import SellerProductRequest from "../models/sellerProductRequest.js";
import SellerInventory from "../models/sellerInventory.js";
import Product from "../models/product.js";
import Delivery from "../models/delivery.js";
import Notification from "../models/notification.js";
import { emitToDelivery } from "./orderSocketEmitter.js";
import { emitNotificationEvent } from "../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";
import { invalidateProductStockCache } from "./stockService.js";
import logger from "./logger.js";

/**
 * A seller product request moves stock in two separate steps:
 *
 *  1. On approval the goods leave the admin warehouse, so the master
 *     product's stock drops (`reserveWarehouseStockForRequest`). Nothing is
 *     given to the seller yet — the carton is in transit.
 *  2. Only once the rider has handed the goods over (4-digit PIN validated)
 *     AND the money is settled do the products land in the seller's own
 *     catalogue (`materializeSellerRequestStock`).
 *
 * Keeping the two apart is what stops an approved-but-undelivered request
 * from showing up in /seller/products.
 */

/**
 * Resolve the master (admin) product a request line points at, following the
 * `adminProductId` link so a clone is never cloned again.
 */
async function resolveMasterProduct(productId) {
  const product = await Product.findById(productId);
  if (!product) return null;
  if (!product.adminProductId) return product;
  const master = await Product.findById(product.adminProductId);
  return master || product;
}

function resolveVariantIndex(variants, variantSku) {
  if (!Array.isArray(variants) || variants.length === 0) return -1;
  if (variantSku) {
    const index = variants.findIndex(
      (v) => String(v.sku || "").trim() === String(variantSku).trim(),
    );
    if (index !== -1) return index;
  }
  return 0;
}

/**
 * Step 1 — the carton leaves the warehouse.
 *
 * Decrements the master product's stock by the requested quantity. Idempotent
 * via `warehouseStockReservedAt`, so a double-approve (or a retried request)
 * cannot drain the warehouse twice.
 */
export async function reserveWarehouseStockForRequest(request) {
  if (request.warehouseStockReservedAt) {
    return { reserved: false, reason: "ALREADY_RESERVED" };
  }

  const touchedProductIds = [];

  for (const item of request.items || []) {
    const quantity = item.quantity || 0;
    if (!item.productId || quantity <= 0) continue;

    const master = await resolveMasterProduct(item.productId);
    // Only warehouse-owned stock is drawn down; a seller-owned product is
    // never a valid source for an admin-to-seller supply.
    if (!master || master.sellerId) continue;

    if (quantity > Number(master.stock || 0)) {
      logger.warn("[reserveWarehouseStockForRequest] Warehouse short on stock", {
        requestNumber: request.requestNumber,
        product: master.name,
        available: master.stock || 0,
        requested: quantity,
      });
    }

    master.stock = Math.max(0, Number(master.stock || 0) - quantity);

    const vIndex = resolveVariantIndex(master.variants, item.variantSku);
    if (vIndex !== -1 && master.variants[vIndex]) {
      master.variants[vIndex].stock = Math.max(
        0,
        Number(master.variants[vIndex].stock || 0) - quantity,
      );
    }

    await master.save();
    touchedProductIds.push(String(master._id));
  }

  request.warehouseStockReservedAt = new Date();
  await request.save();

  if (touchedProductIds.length > 0) {
    invalidateProductStockCache(touchedProductIds).catch(() => {});
  }

  return { reserved: true, productIds: touchedProductIds };
}

/**
 * Undo step 1 — the carton never left, or came back.
 *
 * Used when an approved request is rejected or cancelled before the seller
 * ever received it, so the warehouse gets its stock back.
 */
export async function releaseWarehouseStockForRequest(request) {
  if (!request.warehouseStockReservedAt) {
    return { released: false, reason: "NOTHING_RESERVED" };
  }
  if (request.stockMaterializedAt) {
    // The seller already owns these goods; returning them to the warehouse
    // here would create stock out of thin air.
    return { released: false, reason: "ALREADY_WITH_SELLER" };
  }

  const touchedProductIds = [];

  for (const item of request.items || []) {
    const quantity = item.quantity || 0;
    if (!item.productId || quantity <= 0) continue;

    const master = await resolveMasterProduct(item.productId);
    if (!master || master.sellerId) continue;

    master.stock = Number(master.stock || 0) + quantity;

    const vIndex = resolveVariantIndex(master.variants, item.variantSku);
    if (vIndex !== -1 && master.variants[vIndex]) {
      master.variants[vIndex].stock =
        Number(master.variants[vIndex].stock || 0) + quantity;
    }

    await master.save();
    touchedProductIds.push(String(master._id));
  }

  request.warehouseStockReservedAt = null;
  await request.save();

  if (touchedProductIds.length > 0) {
    invalidateProductStockCache(touchedProductIds).catch(() => {});
  }

  return { released: true, productIds: touchedProductIds };
}

/**
 * True only when the seller has both received the goods and settled the bill.
 * This is the single gate that decides whether a requested product may appear
 * in the seller's catalogue.
 */
export function isRequestReadyForSellerStock(request) {
  if (!request) return false;
  const delivered =
    request.status === "DELIVERED" ||
    request.deliveryWorkflowStatus === "DELIVERED";
  const paid = request.paymentStatus === "PAID";
  return delivered && paid;
}

/**
 * Step 2 — the goods become the seller's own stock.
 *
 * Creates/updates the SellerInventory row and the seller's catalogue Product
 * for every line in the request. Idempotent via `stockMaterializedAt`.
 *
 * Refuses to run until `isRequestReadyForSellerStock` holds, which is what
 * keeps approved-but-undelivered (or delivered-but-unpaid) requests out of
 * /seller/products.
 */
export async function materializeSellerRequestStock(requestOrId) {
  const request =
    typeof requestOrId === "object" && requestOrId?.items
      ? requestOrId
      : await SellerProductRequest.findById(requestOrId);

  if (!request) {
    return { materialized: false, reason: "REQUEST_NOT_FOUND" };
  }

  if (request.stockMaterializedAt) {
    return { materialized: false, reason: "ALREADY_MATERIALIZED" };
  }

  if (!isRequestReadyForSellerStock(request)) {
    logger.info("[materializeSellerRequestStock] Gate not satisfied; holding stock", {
      requestNumber: request.requestNumber,
      status: request.status,
      deliveryWorkflowStatus: request.deliveryWorkflowStatus,
      paymentStatus: request.paymentStatus,
    });
    return {
      materialized: false,
      reason:
        request.paymentStatus === "PAID" ? "NOT_DELIVERED" : "PAYMENT_PENDING",
    };
  }

  // Claim the request before doing any writes so two concurrent callers (OTP
  // validation and a payment webhook landing at the same moment) cannot both
  // credit the seller.
  const claimed = await SellerProductRequest.findOneAndUpdate(
    { _id: request._id, stockMaterializedAt: null },
    { $set: { stockMaterializedAt: new Date() } },
    { new: true },
  );

  if (!claimed) {
    return { materialized: false, reason: "ALREADY_MATERIALIZED" };
  }

  const now = claimed.stockMaterializedAt;
  const sellerId = claimed.sellerId;
  const sellerName = claimed.sellerName || "Unknown Seller";
  const touchedProductIds = [];

  try {
    for (const item of claimed.items || []) {
      const quantity = item.quantity || 0;
      if (!item.productId || quantity <= 0) continue;

      const master = await resolveMasterProduct(item.productId);
      if (!master) {
        logger.warn("[materializeSellerRequestStock] Master product missing", {
          requestNumber: claimed.requestNumber,
          productId: String(item.productId),
        });
        continue;
      }

      // ── Seller inventory ledger ────────────────────────────────
      const existingInventory = await SellerInventory.findOne({
        sellerId,
        productId: master._id,
      });

      if (existingInventory) {
        existingInventory.availableStock =
          Number(existingInventory.availableStock || 0) + quantity;
        existingInventory.totalStock =
          Number(existingInventory.totalStock || 0) + quantity;
        existingInventory.status = "ACTIVE";
        await existingInventory.save();
      } else {
        await SellerInventory.create({
          sellerId,
          sellerName,
          productId: master._id,
          productName: item.productName || master.name,
          productImage:
            master.mainImage || master.images?.[0] || item.productImage || "",
          productSku: master.sku || "",
          category: item.category || master.category || "General",
          subCategory: master.subCategory || "",
          description: master.description || "",
          originalPrice: item.pricePerUnit ?? master.price,
          sellerPrice: item.pricePerUnit ?? master.salePrice ?? master.price,
          totalStock: quantity,
          availableStock: quantity,
          soldStock: 0,
          status: "ACTIVE",
          requestId: claimed._id,
          requestNumber: claimed.requestNumber,
          paymentType: claimed.paymentType || "PAY_NOW",
          paymentStatus: claimed.paymentStatus || "PAID",
          approvedAt: now,
        });
      }

      // ── Seller catalogue product (what /seller/products lists) ──
      const masterId = master._id;
      const existingSellerProduct = await Product.findOne({
        adminProductId: masterId,
        sellerId,
      });

      if (existingSellerProduct) {
        existingSellerProduct.stock =
          Number(existingSellerProduct.stock || 0) + quantity;
        const vIndex = resolveVariantIndex(
          existingSellerProduct.variants,
          item.variantSku,
        );
        if (vIndex !== -1 && existingSellerProduct.variants[vIndex]) {
          existingSellerProduct.variants[vIndex].stock =
            Number(existingSellerProduct.variants[vIndex].stock || 0) + quantity;
        }
        await existingSellerProduct.save();
        touchedProductIds.push(String(existingSellerProduct._id));
      } else {
        const baseObj = master.toObject();
        delete baseObj._id;
        delete baseObj.__v;
        delete baseObj.sellerId;
        delete baseObj.adminProductId;
        delete baseObj.stock;
        delete baseObj.slug;
        delete baseObj.sku;
        delete baseObj.createdAt;
        delete baseObj.updatedAt;

        const clonedVariants = Array.isArray(baseObj.variants)
          ? baseObj.variants.map((v) => ({ ...v, stock: 0 }))
          : [];
        const vIndex = resolveVariantIndex(clonedVariants, item.variantSku);
        if (vIndex !== -1 && clonedVariants[vIndex]) {
          clonedVariants[vIndex].stock = quantity;
        }

        const uniqueSuffix = `-${sellerId.toString().slice(-6)}-${Date.now()
          .toString()
          .slice(-4)}`;

        const created = await Product.create({
          ...baseObj,
          stock: quantity,
          variants: clonedVariants,
          sellerId,
          adminProductId: masterId,
          slug: `${master.slug}${uniqueSuffix}`,
          sku: `${master.sku || "SKU"}${uniqueSuffix}`,
          lastSubmittedByRole: "admin",
          approvalStatus: "approved",
          approvalNote:
            "Automatically approved on delivery of admin warehouse supply.",
        });
        touchedProductIds.push(String(created._id));
      }
    }

    if (touchedProductIds.length > 0) {
      invalidateProductStockCache(touchedProductIds).catch(() => {});
    }

    logger.info("[materializeSellerRequestStock] Seller stock credited", {
      requestNumber: claimed.requestNumber,
      sellerId: String(sellerId),
      lines: (claimed.items || []).length,
    });

    return { materialized: true, request: claimed, productIds: touchedProductIds };
  } catch (error) {
    // Release the claim so a retry (admin re-trigger, webhook redelivery) can
    // finish the job instead of the request being stuck half-credited.
    await SellerProductRequest.updateOne(
      { _id: claimed._id },
      { $set: { stockMaterializedAt: null } },
    );
    logger.error("[materializeSellerRequestStock] Failed to credit seller stock", {
      requestNumber: claimed.requestNumber,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Tell a rider they have been put on a seller request: socket event, FCM push
 * and an in-app notification row. Shared by every assignment path so the
 * rider's alert never depends on which screen the assignment came from.
 */
export async function notifyRiderOfRequestAssignment(request, deliveryBoyId, { manual = true } = {}) {
  const payload = {
    orderId: request.requestNumber,
    sourceType: "SELLER_REQUEST",
    workflowStatus: "DELIVERY_ASSIGNED",
    preview: {
      pickup: "Veenolex Wholesale Warehouse",
      drop: request.sellerName || "Seller Store",
      total: request.totalAmount || 0,
    },
  };

  const body = manual
    ? `You have been assigned to deliver ${request.requestNumber}`
    : `New delivery ${request.requestNumber} is ready for pickup`;

  try {
    emitToDelivery(deliveryBoyId, { event: "delivery:assigned", payload });

    const rider = await Delivery.findById(deliveryBoyId).select("fcmToken").lean();
    if (rider?.fcmToken) {
      emitNotificationEvent(NOTIFICATION_EVENTS.BULK_PUSH, {
        messages: [
          {
            token: rider.fcmToken,
            notification: { title: "New Delivery Assigned", body },
            data: {
              event: "delivery:assigned",
              payload: JSON.stringify(payload),
            },
          },
        ],
      });
    }

    const notificationDoc = await Notification.create({
      recipient: deliveryBoyId,
      userId: deliveryBoyId,
      recipientModel: "Delivery",
      role: "delivery",
      title: "Delivery Assigned",
      message: body,
      body,
      type: "order",
      channel: "in_app",
      provider: "internal",
      status: "sent",
      sentAt: new Date(),
      data: { orderId: request.requestNumber, sourceType: "SELLER_REQUEST" },
    });

    emitToDelivery(deliveryBoyId, {
      event: "notification:new",
      payload: {
        notificationId: notificationDoc._id.toString(),
        eventType: "DELIVERY_ASSIGNED",
        role: "delivery",
        title: "Delivery Assigned",
        body: notificationDoc.body,
        data: notificationDoc.data,
        createdAt: notificationDoc.createdAt.toISOString(),
      },
    });

    return true;
  } catch (error) {
    logger.warn("[notifyRiderOfRequestAssignment] Rider alert failed", {
      requestNumber: request.requestNumber,
      deliveryBoyId: String(deliveryBoyId),
      error: error.message,
    });
    return false;
  }
}
