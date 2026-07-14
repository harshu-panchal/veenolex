import crypto from "crypto";
import Order from "../models/order.js";
import SellerProductRequest from "../models/sellerProductRequest.js";
import DeliveryShipment from "../models/deliveryShipment.js";
import DeliveryWebhookEvent from "../models/deliveryWebhookEvent.js";
import { emitToOrder } from "../services/orderSocketEmitter.js";

// Mapping of Shiprocket status codes/strings to internal workflow statuses
const MAP_STATUSES = {
  // Delivered status
  "DELIVERED": "DELIVERED",
  "COMPLETE": "DELIVERED",
  // Out for delivery / Shipped status
  "OUT FOR DELIVERY": "OUT_FOR_DELIVERY",
  "OUT_FOR_DELIVERY": "OUT_FOR_DELIVERY",
  "DISPATCHED": "OUT_FOR_DELIVERY",
  "SHIPPED": "OUT_FOR_DELIVERY",
  // Pickup ready status
  "PICKUP READY": "PICKUP_READY",
  "PICKUP_READY": "PICKUP_READY",
  "READY FOR PICKUP": "PICKUP_READY",
  "READY_FOR_PICKUP": "PICKUP_READY",
};

export const handleShiprocketWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-sha256-signature"] || req.headers["x-api-key"];
    const secret = process.env.SHIPROCKET_WEBHOOK_SECRET;
    const rawBody = req.body;
    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : rawBody;

    // 1. Signature validation (invalid signature -> 401, no DB write, no queue enqueue)
    if (secret && signature) {
      const computedSignature = crypto
        .createHmac("sha256", secret)
        .update(bodyStr)
        .digest("hex");
      if (computedSignature !== signature) {
        console.warn("⚠️ Shiprocket webhook signature mismatch!");
        return res.status(401).send("Unauthorized: Invalid signature");
      }
    }

    const payload = JSON.parse(bodyStr || "{}");
    const shipRocketOrderId = payload.order_id?.toString() || payload.id?.toString();
    const currentStatus = payload.current_status || payload.status || "UNKNOWN";
    const awb = payload.awb || payload.awb_code;

    // 2. Idempotency Check (duplicate event ID -> 200, no-op)
    const payloadHash = crypto.createHash("sha256").update(bodyStr).digest("hex");
    const eventId = payload.event_id || payload.id || payloadHash;

    const existingEvent = await DeliveryWebhookEvent.findOne({ eventId });
    if (existingEvent) {
      console.log(`ℹ️ Duplicate webhook event detected for eventId: ${eventId} (no-op)`);
      return res.status(200).send("OK: Duplicate event ignored");
    }

    if (!shipRocketOrderId) {
      return res.status(400).send("Bad Request: Missing order_id");
    }

    // 3. Find matching Order or SellerProductRequest
    let target = null;
    let targetType = null; // "ORDER" or "REQUEST"

    // Search Orders
    let order = await Order.findOne({ "shipRocketDetails.orderId": shipRocketOrderId });
    if (order) {
      target = order;
      targetType = "ORDER";
    } else {
      // Search SellerProductRequests
      let request = await SellerProductRequest.findOne({ "shipRocketDetails.orderId": shipRocketOrderId });
      if (request) {
        target = request;
        targetType = "REQUEST";
      }
    }

    // If no matching order/request is found -> log, discard, return 200 (does not 500)
    if (!target) {
      console.warn(`⚠️ Webhook received but no matching Order or SellerProductRequest found in database for shipRocketOrderId: ${shipRocketOrderId}`);
      // Record event processing anyway to prevent future duplicates of this discarded event
      await DeliveryWebhookEvent.create({ eventId, payloadHash });
      return res.status(200).send("OK: Discarded (Order not found)");
    }

    // 4. Record the webhook event processing (DB write for idempotency key)
    await DeliveryWebhookEvent.create({ eventId, payloadHash });

    // 5. Update or Create the DeliveryShipment tracking record and timeline
    const orderId = targetType === "ORDER" ? target.orderId : target.requestNumber;
    let shipment = await DeliveryShipment.findOne({ shipRocketOrderId });
    if (!shipment) {
      shipment = new DeliveryShipment({
        orderId,
        shipRocketOrderId,
        awbCode: awb || target.shipRocketDetails?.trackingNumber || "",
        status: currentStatus,
      });
    }

    // Add activity log to timeline
    shipment.timeline.push({
      status: currentStatus,
      activity: payload.activity || `Shiprocket update: ${currentStatus}`,
      location: payload.location || payload.city || "Unknown Location",
      timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
    });
    shipment.status = currentStatus;
    if (awb) shipment.awbCode = awb;
    await shipment.save();

    // 6. Transition order status if the status matches a mapped transition
    const normalized = String(currentStatus).toUpperCase();
    const mappedWorkflowStatus = MAP_STATUSES[normalized];

    if (mappedWorkflowStatus) {
      if (targetType === "ORDER") {
        target.shipRocketDetails.status = currentStatus;
        if (awb) target.shipRocketDetails.trackingNumber = awb;
        if (payload.etd) target.shipRocketDetails.estimatedDelivery = new Date(payload.etd);

        if (mappedWorkflowStatus === "DELIVERED") {
          target.workflowStatus = "DELIVERED";
          target.orderStatus = "delivered";
          target.status = "delivered";
          target.deliveredAt = new Date();
        } else if (mappedWorkflowStatus === "OUT_FOR_DELIVERY") {
          target.workflowStatus = "OUT_FOR_DELIVERY";
          target.orderStatus = "out_for_delivery";
          target.status = "out_for_delivery";
        }
        await target.save();

        // Emit real-time tracking update to standard order rooms
        emitToOrder(target.orderId, {
          event: "order:status:update",
          payload: {
            orderId: target.orderId,
            status: target.status,
            workflowStatus: target.workflowStatus,
            shipRocketDetails: target.shipRocketDetails
          }
        });
      } else {
        // SellerProductRequest transition
        target.shipRocketDetails.status = currentStatus;
        if (awb) target.shipRocketDetails.trackingNumber = awb;
        if (payload.etd) target.shipRocketDetails.estimatedDelivery = new Date(payload.etd);

        if (mappedWorkflowStatus === "DELIVERED") {
          target.status = "DELIVERED";
          target.deliveryWorkflowStatus = "DELIVERED";
          target.deliveredAt = new Date();
        } else if (mappedWorkflowStatus === "OUT_FOR_DELIVERY") {
          target.deliveryWorkflowStatus = "OUT_FOR_DELIVERY";
        }
        await target.save();
      }
      console.log(`✅ Shipment status updated & Order/Request transitioned: ${orderId} -> ${mappedWorkflowStatus}`);
    } else {
      // Unmapped status: stored in timeline, order status unchanged, warning logged, no crash
      console.warn(`⚠️ Shiprocket webhook sent an unmapped tracking status: "${currentStatus}" for ${orderId}. Timeline updated, order status unchanged.`);
      // Just save the details on target shipRocketDetails without changing core order status
      target.shipRocketDetails.status = currentStatus;
      if (awb) target.shipRocketDetails.trackingNumber = awb;
      await target.save();
    }

    return res.status(200).send("OK: Webhook processed successfully");
  } catch (error) {
    console.error("❌ Error in Shiprocket webhook handler:", error);
    return res.status(500).send("Internal Server Error");
  }
};
