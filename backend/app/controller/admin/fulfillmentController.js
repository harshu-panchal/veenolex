import Order from "../../models/order.js";
import Setting from "../../models/setting.js";
import User from "../../models/customer.js";
import handleResponse from "../../utils/helper.js";
import { getPagination } from "../../utils/pagination.js";
import { WORKFLOW_STATUS } from "../../constants/orderWorkflow.js";
import { isRedisEnabled } from "../../config/redis.js";
import { shiprocketQueue, JOB_NAMES } from "../../queues/orderQueues.js";
import { createShipRocketOrder } from "../../../utils/shipRocketService.js";
import { refreshOrderDeliveryEta } from "../../services/deliveryEtaService.js";
import {
  ADMIN_FULFILLER,
  getFulfillmentWarehouse,
  invalidateWarehouseCache,
} from "../../services/fulfillmentRoutingService.js";
import {
  adminAcceptAtomic,
  adminRejectAtomic,
  adminDispatchViaShiprocket,
  adminAssignDeliveryPartnerAtomic,
  triggerOrderDeliveryBroadcast,
} from "../../services/orderWorkflowService.js";

const IN_DELIVERY = [
  WORKFLOW_STATUS.DELIVERY_SEARCH,
  WORKFLOW_STATUS.DELIVERY_ASSIGNED,
  WORKFLOW_STATUS.PICKUP_READY,
  WORKFLOW_STATUS.OUT_FOR_DELIVERY,
];

/** Tabs of the admin "Warehouse Orders" queue. */
const TAB_FILTERS = {
  pending: { workflowStatus: WORKFLOW_STATUS.SELLER_PENDING },
  accepted: {
    workflowStatus: WORKFLOW_STATUS.SELLER_ACCEPTED,
    $or: [
      { deliveryType: { $ne: "SHIPROCKET" } },
      { "shipRocketDetails.status": "SHIPMENT_FAILED" },
    ],
  },
  dispatched: {
    $or: [
      { workflowStatus: { $in: IN_DELIVERY } },
      {
        workflowStatus: WORKFLOW_STATUS.SELLER_ACCEPTED,
        deliveryType: "SHIPROCKET",
        "shipRocketDetails.status": { $ne: "SHIPMENT_FAILED" },
      },
    ],
  },
  completed: {
    workflowStatus: { $in: [WORKFLOW_STATUS.DELIVERED, WORKFLOW_STATUS.CANCELLED] },
  },
};

const LIST_FIELDS =
  "orderId customer items address pricing paymentBreakdown.grandTotal paymentBreakdown.codBalanceDue codAdvance paymentMode paymentStatus workflowStatus status fulfilledBy routedReason routingHistory sellerPendingExpiresAt sellerAcceptedAt deliveryBoy deliveryType shipRocketDetails deliverySearchExpiresAt adminReminderCount deliveryEta createdAt";

export const listFulfillmentOrders = async (req, res) => {
  try {
    const tab = TAB_FILTERS[req.query.tab] ? req.query.tab : "pending";
    const base = { fulfilledBy: ADMIN_FULFILLER, workflowVersion: { $gte: 2 } };
    const { page, limit, skip } = getPagination(req, { defaultLimit: 20, maxLimit: 100 });

    const query = { ...base, ...TAB_FILTERS[tab] };
    const [items, total, ...counts] = await Promise.all([
      Order.find(query)
        .select(LIST_FIELDS)
        .populate("customer", "name phone")
        .populate("deliveryBoy", "name phone")
        .populate("routingHistory.seller", "shopName")
        .sort({ createdAt: tab === "pending" ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
      ...Object.values(TAB_FILTERS).map((filter) => Order.countDocuments({ ...base, ...filter })),
    ]);

    const tabCounts = Object.fromEntries(
      Object.keys(TAB_FILTERS).map((key, index) => [key, counts[index]]),
    );

    return handleResponse(res, 200, "Warehouse orders fetched", {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      tab,
      counts: tabCounts,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const acceptFulfillmentOrder = async (req, res) => {
  try {
    const order = await adminAcceptAtomic(req.user.id, req.params.orderId);
    return handleResponse(res, 200, "Order accepted", order);
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

export const rejectFulfillmentOrder = async (req, res) => {
  try {
    const order = await adminRejectAtomic(req.user.id, req.params.orderId, req.body?.reason);
    return handleResponse(res, 200, "Order rejected and customer refunded", order);
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

async function startShiprocketShipment(order) {
  if (isRedisEnabled() && shiprocketQueue) {
    await shiprocketQueue.add(
      JOB_NAMES.SHIPROCKET_CREATE,
      { type: "ORDER", id: order._id },
      { attempts: 5, backoff: { type: "exponential", delay: 5000 } },
    );
    return { queued: true };
  }

  const [user, warehouse] = await Promise.all([
    User.findById(order.customer).lean(),
    getFulfillmentWarehouse(),
  ]);
  const details = await createShipRocketOrder(order, user || {}, order.address, null, order.items, {
    pickupLocation: warehouse.shiprocketPickupLocation || undefined,
    pickupPostcode: warehouse.pincode,
    weightKg: warehouse.packageWeightKg,
  });
  await refreshOrderDeliveryEta(order._id);
  return { queued: false, details };
}

/**
 * Dispatch an accepted warehouse order.
 * body: { mode: "BROADCAST" | "MANUAL" | "SHIPROCKET", deliveryBoyId? }
 */
export const dispatchFulfillmentOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const mode = String(req.body?.mode || "").toUpperCase();
    const adminId = req.user.id;

    if (mode === "BROADCAST") {
      const order = await triggerOrderDeliveryBroadcast(null, orderId, { asAdmin: true });
      return handleResponse(res, 200, "Searching for nearby riders", order);
    }

    if (mode === "MANUAL") {
      if (!req.body?.deliveryBoyId) {
        return handleResponse(res, 400, "deliveryBoyId is required");
      }
      const order = await adminAssignDeliveryPartnerAtomic(adminId, orderId, req.body.deliveryBoyId);
      return handleResponse(res, 200, "Delivery partner assigned", order);
    }

    if (mode === "SHIPROCKET") {
      const order = await adminDispatchViaShiprocket(adminId, orderId);
      try {
        const result = await startShiprocketShipment(order);
        return handleResponse(
          res,
          200,
          result.queued ? "Shiprocket shipment is being created" : "Shiprocket shipment created",
          order,
        );
      } catch (shipError) {
        return handleResponse(res, 502, `Shiprocket failed: ${shipError.message}`);
      }
    }

    return handleResponse(res, 400, "mode must be BROADCAST, MANUAL or SHIPROCKET");
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

export const getWarehouseSettings = async (req, res) => {
  try {
    const settings = await Setting.findOne({}).select("fulfillmentWarehouse").lean();
    const resolved = await getFulfillmentWarehouse();
    return handleResponse(res, 200, "Warehouse settings fetched", {
      configured: settings?.fulfillmentWarehouse || {},
      resolved,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

const WAREHOUSE_FIELDS = {
  name: String,
  address: String,
  city: String,
  state: String,
  pincode: String,
  phone: String,
  lat: Number,
  lng: Number,
  serviceRadiusKm: Number,
  shiprocketPickupLocation: String,
  adminAcceptTimeoutMinutes: Number,
  localDeliveryMaxHours: Number,
  standardDeliveryDaysMin: Number,
  standardDeliveryDaysMax: Number,
  packageWeightKg: Number,
};

export const updateWarehouseSettings = async (req, res) => {
  try {
    const toSet = {};
    for (const [key, cast] of Object.entries(WAREHOUSE_FIELDS)) {
      if (req.body?.[key] === undefined) continue;
      const raw = req.body[key];
      if (cast === Number) {
        const value = raw === null || raw === "" ? null : Number(raw);
        if (value !== null && !Number.isFinite(value)) {
          return handleResponse(res, 400, `${key} must be a number`);
        }
        toSet[`fulfillmentWarehouse.${key}`] = value;
      } else {
        toSet[`fulfillmentWarehouse.${key}`] = String(raw).trim();
      }
    }

    const pincode = toSet["fulfillmentWarehouse.pincode"];
    if (pincode && !/^[0-9]{6}$/.test(pincode)) {
      return handleResponse(res, 400, "pincode must be 6 digits");
    }

    const settings = await Setting.findOneAndUpdate(
      {},
      { $set: toSet },
      { new: true, upsert: true },
    ).select("fulfillmentWarehouse");
    invalidateWarehouseCache();

    return handleResponse(res, 200, "Warehouse settings updated", {
      configured: settings.fulfillmentWarehouse,
      resolved: await getFulfillmentWarehouse(),
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
