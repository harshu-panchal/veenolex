import Order from "../models/order.js";
import Delivery from "../models/delivery.js";
import Seller from "../models/seller.js";
import CheckoutGroup from "../models/checkoutGroup.js";
import SellerProductRequest from "../models/sellerProductRequest.js";
import {
  WORKFLOW_STATUS,
  DEFAULT_DELIVERY_TIMEOUT_MS,
} from "../constants/orderWorkflow.js";
import { distanceMeters } from "../utils/geoUtils.js";
import {
  orderMatchQueryFlexible,
} from "../utils/orderLookup.js";
import { buildKey, getOrSet, getTTL } from "./cacheService.js";
import { resolveWorkflowStatus } from "./orderWorkflowService.js";
import logger from "./logger.js";

function svcErr(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function refToIdString(ref) {
  if (ref == null) return "";
  if (typeof ref === "object" && ref._id != null) return String(ref._id);
  return String(ref);
}

function normalizeSellerStatusFilter(statusParam) {
  if (!statusParam || statusParam === "all") {
    return {};
  }

  if (statusParam === "pending") {
    return { status: "pending" };
  }
  if (statusParam === "processed") {
    return { status: { $in: ["confirmed", "packed"] } };
  }
  if (statusParam === "out-for-delivery") {
    return { status: "out_for_delivery" };
  }
  if (statusParam === "delivered") {
    return { status: "delivered" };
  }
  if (statusParam === "cancelled") {
    return { status: "cancelled" };
  }
  if (statusParam === "returned") {
    return { returnStatus: { $ne: "none" } };
  }

  return {};
}

function appendDateRange(query, { startDate, endDate }) {
  if (!startDate && !endDate) {
    return query;
  }

  const range = {};
  if (startDate) {
    range.$gte = new Date(startDate);
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }

  return {
    ...query,
    createdAt: range,
  };
}

export function buildSellerOrdersQuery({
  role,
  userId,
  statusParam,
  startDate,
  endDate,
  sellerId,
}) {
  const base = role === "admin"
    ? (sellerId ? { seller: sellerId } : {})
    : { seller: userId };
  const withStatus = {
    ...base,
    ...normalizeSellerStatusFilter(statusParam),
  };
  
  let query = appendDateRange(withStatus, { startDate, endDate });

  // For sellers, restrict orders strictly to the last 40 days
  if (role === "seller") {
    const fortyDaysAgo = new Date();
    fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);
    fortyDaysAgo.setHours(0, 0, 0, 0);

    if (query.createdAt) {
      const existingGte = query.createdAt.$gte ? new Date(query.createdAt.$gte) : null;
      if (!existingGte || existingGte < fortyDaysAgo) {
        query.createdAt.$gte = fortyDaysAgo;
      }
    } else {
      query.createdAt = { $gte: fortyDaysAgo };
    }
  }

  return query;
}

export async function fetchSellerOrdersPage({
  role,
  userId,
  statusParam,
  startDate,
  endDate,
  skip,
  limit,
  sellerId,
}) {
  const query = buildSellerOrdersQuery({
    role,
    userId,
    statusParam,
    startDate,
    endDate,
    sellerId,
  });

  const [orders, total, summaryRows] = await Promise.all([
    Order.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate("customer", "name phone")
      .populate("items.product", "name mainImage price salePrice")
      .populate("deliveryBoy", "name phone")
      .populate("seller", "shopName name")
      .lean(),
    Order.countDocuments(query),
    Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ["$pricing.total", 0] } },
          pending: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          confirmed: {
            $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] },
          },
          packed: {
            $sum: { $cond: [{ $eq: ["$status", "packed"] }, 1, 0] },
          },
          outForDelivery: {
            $sum: { $cond: [{ $eq: ["$status", "out_for_delivery"] }, 1, 0] },
          },
          delivered: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
          returned: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$returnStatus", null] },
                    { $ne: ["$returnStatus", ""] },
                    { $ne: ["$returnStatus", "none"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  const rawSummary = summaryRows?.[0] || {};
  const summary = {
    totalOrders: Number(rawSummary.totalOrders || 0),
    totalAmount: Number(rawSummary.totalAmount || 0),
    pending: Number(rawSummary.pending || 0),
    confirmed: Number(rawSummary.confirmed || 0),
    packed: Number(rawSummary.packed || 0),
    outForDelivery: Number(rawSummary.outForDelivery || 0),
    delivered: Number(rawSummary.delivered || 0),
    cancelled: Number(rawSummary.cancelled || 0),
    returned: Number(rawSummary.returned || 0),
  };
  summary.activeOrders =
    summary.pending +
    summary.confirmed +
    summary.packed +
    summary.outForDelivery;

  return {
    query,
    orders,
    total,
    summary,
  };
}

function parseAvailableOrdersLimit(requestedLimit) {
  const maxLimit = 50;
  const parsed = parseInt(requestedLimit, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 20;
  }
  return Math.min(parsed, maxLimit);
}

async function resolveNearbySellerIds(deliveryPartner, userId) {
  const nearbySellers = await Seller.find({
    location: {
      $near: {
        $geometry: deliveryPartner.location,
        $maxDistance: 5000,
      },
    },
  }).select("_id");

  let sellerIds = nearbySellers.map((seller) => seller._id);
  let usedFallback = false;

  if (sellerIds.length === 0 && process.env.NODE_ENV !== "production") {
    const allSellers = await Seller.find({}).select("_id");
    sellerIds = allSellers.map((seller) => seller._id);
    usedFallback = true;
    console.log(
      `DEV LOG - Radius search found 0 sellers. Bypassing radius check for Delivery Partner: ${userId}`,
    );
  }

  return {
    sellerIds,
    usedFallback,
  };
}

/**
 * Availability filter for seller restock requests broadcast to riders.
 *
 * Mirrors the constraints the order and return-pickup queries in this file
 * already apply. Exported so the rules can be asserted without a database —
 * each one is load-bearing, and dropping any of them puts stale or unrelated
 * requests back into every rider's feed:
 *
 *   - still broadcasting, with no rider attached
 *   - not already declined by this rider
 *   - destined for a seller near this rider
 *   - inside its broadcast window
 */
export function buildAvailableSellerRequestQuery({
  userId,
  sellerIds,
  now = new Date(),
}) {
  // Rows written before deliverySearchExpiresAt was persisted have no window of
  // their own. Bound them by their last update instead of showing them forever,
  // which is what kept months-old requests alive in the rider pool.
  const legacyCutoff = new Date(now.getTime() - DEFAULT_DELIVERY_TIMEOUT_MS());

  return {
    deliveryWorkflowStatus: WORKFLOW_STATUS.DELIVERY_SEARCH,
    deliveryBoy: null,
    skippedBy: { $nin: [userId] },
    sellerId: { $in: sellerIds },
    $or: [
      { deliverySearchExpiresAt: { $gt: now } },
      { deliverySearchExpiresAt: null, updatedAt: { $gt: legacyCutoff } },
    ],
  };
}

function filterV2OrdersByRadius(v2Orders, deliveryCoords) {
  const [dlng, dlat] = deliveryCoords;
  return v2Orders.filter((order) => {
    const coords = order.seller?.location?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return true;

    const [slng, slat] = coords;
    const searchR = order.deliverySearchMeta?.radiusMeters || 5000;
    const serviceKm = Number(order.seller?.serviceRadius ?? 5);
    const serviceM = Math.max(serviceKm, 0) * 1000;
    const maxR = Math.min(searchR, serviceM);
    return distanceMeters(dlat, dlng, slat, slng) <= maxR;
  });
}

function mergeAvailableOrders(v2Orders, legacyOrders, returnPickups, limit) {
  const seen = new Set();
  const merged = [];

  for (const order of [...v2Orders, ...legacyOrders, ...returnPickups]) {
    if (seen.has(order.orderId)) continue;
    seen.add(order.orderId);
    merged.push(order);
    if (merged.length >= limit) break;
  }

  return merged;
}

export async function fetchAvailableOrdersForDelivery({
  userId,
  requestedLimit,
  type = "delivery",
}) {
  const limit = parseAvailableOrdersLimit(requestedLimit);
  const showDeliveries = type === "delivery" || type === "all";
  const showReturns = type === "return" || type === "all";

  let assignedReturnPickups = [];
  if (showReturns) {
    const assignedReturnPickupsRaw = await Order.find({
      returnStatus: "return_pickup_assigned",
      returnDeliveryBoy: userId,
      skippedBy: { $nin: [userId] },
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .populate("customer", "name phone")
      .populate("seller", "shopName address name location")
      .lean();

    assignedReturnPickups = assignedReturnPickupsRaw.map((rp) => ({
      ...rp,
      isReturnPickup: true,
    }));
  }

  const deliveryPartner = await Delivery.findById(userId);
  if (
    !deliveryPartner ||
    !deliveryPartner.location ||
    !Array.isArray(deliveryPartner.location.coordinates)
  ) {
    return {
      requiresLocation: showDeliveries && assignedReturnPickups.length === 0,
      orders: assignedReturnPickups,
      limit,
    };
  }

  const { sellerIds } = await resolveNearbySellerIds(deliveryPartner, userId);

  let v2Orders = [];
  if (showDeliveries) {
    const v2OrdersRaw = await Order.find({
      workflowVersion: { $gte: 2 },
      workflowStatus: WORKFLOW_STATUS.DELIVERY_SEARCH,
      deliveryBoy: null,
      seller: { $in: sellerIds },
      skippedBy: { $nin: [userId] },
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .populate("customer", "name phone")
      .populate("seller", "shopName address name location serviceRadius")
      .lean();

    v2Orders = filterV2OrdersByRadius(
      v2OrdersRaw,
      deliveryPartner.location.coordinates,
    );
  }

  let legacyOrders = [];
  if (showDeliveries) {
    legacyOrders = await Order.find({
      $or: [
        { workflowVersion: { $exists: false } },
        { workflowVersion: { $lt: 2 } },
      ],
      status: { $in: ["confirmed", "packed"] },
      deliveryBoy: null,
      seller: { $in: sellerIds },
      skippedBy: { $nin: [userId] },
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .populate("customer", "name phone")
      .populate("seller", "shopName address name location")
      .lean();
  }

  let returnPickups = [];
  if (showReturns) {
    const now = new Date();
    const returnPickupsRaw = await Order.find({
      skippedBy: { $nin: [userId] },
      $or: [
        // Manual reassign queue — seller picked "no specific rider" but
        // the broadcast loop hasn't been kicked off yet (or it expired
        // out). These stay visible until a seller re-assigns.
        {
          returnStatus: "return_approved",
          returnDeliveryBoy: null,
          seller: { $in: sellerIds },
        },
        // Active broadcast — only show while the assignment window is
        // still open. Legacy rows without a stored expiry stay visible
        // for backwards compatibility.
        {
          returnStatus: "return_pickup_assigned",
          returnDeliveryBoy: null,
          seller: { $in: sellerIds },
          $or: [
            { returnSearchExpiresAt: { $exists: false } },
            { returnSearchExpiresAt: null },
            { returnSearchExpiresAt: { $gt: now } },
          ],
        },
        // Mine to handle right now — always show, regardless of expiry.
        {
          returnDeliveryBoy: userId,
        },
      ],
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .populate("customer", "name phone")
      .populate("seller", "shopName address name location")
      .lean();

    returnPickups = returnPickupsRaw.map((rp) => ({
      ...rp,
      isReturnPickup: true,
    }));
  }

  let requestedOrders = [];
  if (showDeliveries) {
    const requestedOrdersRaw = await SellerProductRequest.find(
      buildAvailableSellerRequestQuery({ userId, sellerIds }),
    )
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .populate("sellerId", "shopName address name location")
      .lean();

    requestedOrders = requestedOrdersRaw.map((req) => ({
      ...req,
      orderId: req.requestNumber || `REQ-${req._id}`,
      seller: req.sellerId,
      customer: { name: req.sellerName || "Seller Store", phone: req.sellerPhone || "" },
      isSellerRequest: true,
      workflowStatus: req.deliveryWorkflowStatus || WORKFLOW_STATUS.DELIVERY_SEARCH,
      pricing: { total: req.totalAmount || 0 },
    }));
  }

  const orders = mergeAvailableOrders(
    [...v2Orders, ...requestedOrders],
    legacyOrders,
    [...assignedReturnPickups, ...returnPickups],
    limit,
  );

  return {
    requiresLocation: false,
    orders,
    limit,
  };
}

/**
 * Customer-facing paginated order list (cached).
 * Replaces inline logic from orderController.getMyOrders.
 */
export async function getCustomerOrders(customerId, pagination) {
  const { page, limit, skip } = pagination;
  const cacheKey = buildKey(
    "orders",
    "customer",
    `${customerId}:p${page}:l${limit}`,
  );

  return getOrSet(
    cacheKey,
    async () => {
      const [orders, total] = await Promise.all([
        Order.find({ customer: customerId })
          .select(
            "orderId checkoutGroupId customer seller items address payment pricing status workflowStatus workflowVersion returnStatus timeSlot createdAt",
          )
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .populate("items.product", "name mainImage price salePrice")
          .lean(),
        Order.countDocuments({ customer: customerId }),
      ]);

      return {
        items: orders,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      };
    },
    getTTL("orders"),
  );
}

/**
 * Fetches an order with role-based access control. Returns a "virtual" group
 * summary if the ID is a checkout group identifier and no concrete order
 * exists.
 *
 * Throws: 403 (access denied), 404 (not found), 500 (data integrity).
 */
export async function getOrderWithAccess(orderId, userId, role) {
  const orderKey = orderMatchQueryFlexible(orderId);
  if (!orderKey) {
    throw svcErr("Order not found", 404);
  }

  let order = await Order.findOne(orderKey)
    .populate("customer", "name email phone")
    .populate("items.product", "name mainImage price salePrice")
    .populate("deliveryBoy", "name phone")
    .populate("returnDeliveryBoy", "name phone")
    .populate("seller", "shopName name address phone location")
    .lean();

  if (!order) {
    if (orderId && orderId.toUpperCase().startsWith("REQ-")) {
      const request = await SellerProductRequest.findOne({ requestNumber: new RegExp(`^${orderId}$`, "i") })
        .populate("sellerId", "shopName name address locality city state pincode phone location email")
        .populate("deliveryBoy", "name phone")
        .lean();

      if (request) {
        let sellerObj = (request.sellerId && typeof request.sellerId === "object" && request.sellerId.shopName) ? request.sellerId : null;
        if (!sellerObj && request.sellerId) {
          const sellerIdVal = request.sellerId._id || request.sellerId;
          sellerObj = await Seller.findById(sellerIdVal).select("shopName name address locality city state pincode phone location email").lean();
        }
        sellerObj = sellerObj || {};

        const rawAddr = sellerObj.address || request.sellerAddress || request.address || "";
        const parts = [rawAddr, sellerObj.locality, sellerObj.city, sellerObj.state, sellerObj.pincode].filter(Boolean);
        const sellerAddressStr = parts.length > 0 ? parts.join(", ") : (rawAddr || "Seller Store, Indore");
        const sellerNameStr = sellerObj.shopName || sellerObj.name || request.sellerName || "Seller Store";
        const sellerPhoneStr = sellerObj.phone || request.sellerPhone || "";
        const sellerEmailStr = sellerObj.email || request.sellerEmail || "";
        const totalAmt = request.totalAmount || request.total || request.subtotal || request.amount || 0;

        return {
          isGroupSummary: false,
          payload: {
            orderId: request.requestNumber,
            requestNumber: request.requestNumber,
            isSellerRequest: true,
            status: request.status?.toLowerCase() || "pending",
            workflowStatus: request.deliveryWorkflowStatus || request.status || "CREATED",
            paymentStatus: request.paymentStatus === "PAID" ? "PAID" : "PENDING",
            deliveryType: "STANDARD",
            address: {
              name: sellerNameStr,
              fullName: sellerNameStr,
              phone: sellerPhoneStr,
              address: sellerAddressStr,
              addressLine1: sellerAddressStr,
              street: sellerAddressStr,
              completeAddress: sellerAddressStr,
              city: sellerObj.city || "Indore",
              state: sellerObj.state || "MP",
              pincode: sellerObj.pincode || "452001",
              location: sellerObj.location || { type: "Point", coordinates: [75.8577, 22.7196] },
            },
            customer: {
              name: sellerNameStr,
              phone: sellerPhoneStr,
              email: sellerEmailStr,
            },
            customerName: sellerNameStr,
            customerPhone: sellerPhoneStr,
            seller: {
              ...sellerObj,
              name: sellerNameStr,
              phone: sellerPhoneStr,
              shopName: sellerNameStr,
              address: sellerAddressStr,
              location: sellerObj.location || { type: "Point", coordinates: [75.8577, 22.7196] },
            },
            deliveryBoy: request.deliveryBoy,
            deliveryRiderStep: request.deliveryWorkflowStatus === "DELIVERED" ? 4 : request.deliveryWorkflowStatus === "OUT_FOR_DELIVERY" ? 3 : request.deliveryWorkflowStatus === "PICKUP_READY" ? 2 : 1,
            pricing: {
              subtotal: request.subtotal || totalAmt,
              deliveryFee: 0,
              platformFee: request.tax || 0,
              total: totalAmt,
              grandTotal: totalAmt,
            },
            total: totalAmt,
            amount: totalAmt,
            totalAmount: totalAmt,
            grandTotal: totalAmt,
            items: (request.items || []).map(item => ({
              name: item.productName || "Product",
              productName: item.productName || "Product",
              product: { name: item.productName, mainImage: item.productImage },
              quantity: item.quantity || 1,
              price: item.pricePerUnit || 0,
              unitPrice: item.pricePerUnit || 0,
              totalPrice: item.totalPrice || ((item.pricePerUnit || 0) * (item.quantity || 1)),
            })),
            createdAt: request.createdAt,
            otpValidationLocation: request.otpValidationLocation,
          }
        };
      }
    }

    if (orderId && orderId.toUpperCase().startsWith("CHK-")) {
      const group = await CheckoutGroup.findOne({
        checkoutGroupId: orderId,
      }).lean();
      if (group) {
        return {
          isGroupSummary: true,
          payload: {
            orderId: group.checkoutGroupId,
            status: group.status?.toLowerCase() || "pending",
            orderStatus: group.status?.toLowerCase() || "pending",
            paymentStatus:
              group.paymentStatus === "CAPTURED"
                ? "PAID"
                : group.paymentStatus || "CREATED",
            workflowStatus: group.status || "CREATED",
            pricing: {
              subtotal: group.pricingSummary?.subtotal || 0,
              deliveryFee: group.pricingSummary?.deliveryFee || 0,
              platformFee: group.pricingSummary?.platformFee || 0,
              total: group.pricingSummary?.totalAmount || 0,
            },
            address: group.addressSnapshot || {},
            items: [],
            createdAt: group.createdAt,
            isGroupSummary: true,
            isFragmented: true,
          },
        };
      }
    }
    throw svcErr("Order not found", 404);
  }

  // Defensive: customer reference integrity check (BUGFIX preserved)
  if (!order.customer) {
    logger.error("Order has null/undefined customer field", {
      scope: "ORDER_BUG",
      orderId: order.orderId,
      _id: order._id,
      workflowStatus: order.workflowStatus,
    });

    const rawOrder = await Order.findOne(orderKey).lean();
    if (rawOrder && rawOrder.customer) {
      logger.error("Customer reference exists but failed to populate", {
        scope: "ORDER_BUG",
        orderId: order.orderId,
        customerRef: rawOrder.customer,
      });
      order.customer = rawOrder.customer;
    } else {
      logger.error("Customer field is null in database", {
        scope: "ORDER_BUG",
        orderId: order.orderId,
      });
      throw svcErr(
        "Order data integrity error: customer reference is missing",
        500,
      );
    }
  }

  if (!order.workflowStatus) {
    order.workflowStatus = resolveWorkflowStatus(order);
  }

  const uid = userId != null ? String(userId).trim() : "";
  const roleNorm = String(role || "").toLowerCase();
  const sellerIdStr =
    typeof order.seller === "object" && order.seller?._id
      ? order.seller._id.toString()
      : order.seller?.toString();

  const customerIdStr = refToIdString(order.customer);

  const isOwnerCustomer =
    (roleNorm === "customer" || roleNorm === "user") &&
    order.customer &&
    customerIdStr === uid;
  const isOwnerSeller = role === "seller" && sellerIdStr === uid;
  const primaryRiderId = refToIdString(order.deliveryBoy);
  const returnRiderId = refToIdString(order.returnDeliveryBoy);
  const previousRiderId = refToIdString(order.previousDeliveryBoy);
  const isAssignedDeliveryBoy =
    role === "delivery" &&
    (primaryRiderId === uid || returnRiderId === uid || previousRiderId === uid);

  const isBroadcastedOrder =
    role === "delivery" &&
    ((!order.deliveryBoy &&
      order.workflowStatus === WORKFLOW_STATUS.DELIVERY_SEARCH) ||
      (!order.returnDeliveryBoy &&
        ["return_approved", "return_pickup_assigned"].includes(
          order.returnStatus,
        )));

  const isAdmin = role === "admin";

  if (
    !isOwnerCustomer &&
    !isOwnerSeller &&
    !isAssignedDeliveryBoy &&
    !isBroadcastedOrder &&
    !isAdmin
  ) {
    logger.warn("Authorization denied for order", {
      scope: "ORDER_ACCESS",
      orderId: order.orderId,
      requestedBy: uid,
      role: roleNorm,
      customerIdStr,
      hasCustomer: !!order.customer,
    });
    throw svcErr(
      "Access denied. You are not authorized to view this order.",
      403,
    );
  }

  // Enrich order object with consistent customer, address, and pricing fallbacks
  const custName =
    order.customerName ||
    order.address?.name ||
    order.address?.fullName ||
    order.addressSnapshot?.name ||
    (typeof order.customer === "object" ? (order.customer?.name || order.customer?.fullName) : null) ||
    order.customerEmail ||
    (typeof order.customer === "object" ? order.customer?.email : null) ||
    "Customer";

  const custPhone =
    order.customerPhone ||
    order.address?.phone ||
    order.addressSnapshot?.phone ||
    (typeof order.customer === "object" ? order.customer?.phone : null) ||
    "";

  order.customerName = custName;
  order.customerPhone = custPhone;

  if (typeof order.customer === "object" && order.customer !== null) {
    order.customer.name = order.customer.name || custName;
    order.customer.phone = order.customer.phone || custPhone;
  } else {
    order.customer = {
      name: custName,
      phone: custPhone,
      email: order.customerEmail || "",
    };
  }

  if (!order.address || (!order.address.address && !order.address.addressLine1 && !order.address.street && !order.address.completeAddress)) {
    if (order.addressSnapshot) {
      order.address = {
        ...(order.address || {}),
        ...order.addressSnapshot,
      };
    }
  }

  const calculatedTotal =
    order.paymentBreakdown?.grandTotal ??
    order.pricing?.total ??
    order.pricing?.grandTotal ??
    order.totalAmount ??
    order.grandTotal ??
    order.total ??
    order.amount ??
    0;

  order.total = calculatedTotal;
  order.amount = calculatedTotal;
  order.totalAmount = calculatedTotal;
  order.grandTotal = calculatedTotal;

  order.pricing = {
    subtotal: order.paymentBreakdown?.productSubtotal ?? order.pricing?.subtotal ?? calculatedTotal,
    deliveryFee: order.paymentBreakdown?.deliveryFeeCharged ?? order.pricing?.deliveryFee ?? 0,
    platformFee: order.paymentBreakdown?.handlingFeeCharged ?? order.pricing?.platformFee ?? 0,
    total: calculatedTotal,
    grandTotal: calculatedTotal,
    walletAmount: order.paymentBreakdown?.walletAmount ?? order.pricing?.walletAmount ?? order.walletAmount ?? 0,
  };

  return {
    isGroupSummary: false,
    payload: order,
  };
}

/**
 * Returns paginated seller/admin view of orders with active return status.
 */
export async function getSellerReturns({
  role,
  userId,
  filters = {},
  pagination,
}) {
  const { status, startDate, endDate } = filters;
  const { page, limit, skip } = pagination;

  const query = {};
  if (role !== "admin") {
    query.seller = userId;
  }
  query.returnStatus = { $ne: "none" };

  if (status && status !== "all") {
    query.returnStatus = status;
  }

  if (startDate || endDate) {
    query.returnRequestedAt = {};
    if (startDate) {
      query.returnRequestedAt.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.returnRequestedAt.$lte = end;
    }
  }

  const [orders, total] = await Promise.all([
    Order.find(query)
      .sort({ returnRequestedAt: -1, createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate("customer", "name phone")
      .populate("returnDeliveryBoy", "name phone")
      .lean(),
    Order.countDocuments(query),
  ]);

  return {
    items: orders,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export default {
  buildSellerOrdersQuery,
  fetchSellerOrdersPage,
  fetchAvailableOrdersForDelivery,
  getCustomerOrders,
  getOrderWithAccess,
  getSellerReturns,
};
