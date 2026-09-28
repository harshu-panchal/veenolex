import Order from "../models/order.js";
import { WORKFLOW_STATUS } from "../constants/orderWorkflow.js";
import { fetchShiprocketTrackingEtd } from "../../utils/shipRocketService.js";
import { refreshOrderDeliveryEta } from "../services/deliveryEtaService.js";
import logger from "../services/logger.js";

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000;
const RECHECK_AFTER_MS = () =>
  parseInt(process.env.SHIPROCKET_ETA_RECHECK_MS || `${3 * 60 * 60 * 1000}`, 10);
const BATCH_SIZE = 50;

/**
 * Courier orders in transit: re-read the expected delivery date from
 * Shiprocket tracking so the customer's arrival time stays current even
 * when webhooks are missed.
 */
async function refreshShiprocketEtas() {
  const staleBefore = new Date(Date.now() - RECHECK_AFTER_MS());
  const orders = await Order.find({
    deliveryType: "SHIPROCKET",
    workflowStatus: { $nin: [WORKFLOW_STATUS.DELIVERED, WORKFLOW_STATUS.CANCELLED] },
    "shipRocketDetails.trackingNumber": { $nin: [null, "", "Assigning...", "AWB_PENDING"] },
    $or: [
      { "shipRocketDetails.etdCheckedAt": { $exists: false } },
      { "shipRocketDetails.etdCheckedAt": null },
      { "shipRocketDetails.etdCheckedAt": { $lte: staleBefore } },
    ],
  })
    .select("_id orderId shipRocketDetails.trackingNumber")
    .limit(BATCH_SIZE)
    .lean();

  let updated = 0;
  for (const order of orders) {
    try {
      const etd = await fetchShiprocketTrackingEtd(order.shipRocketDetails.trackingNumber);
      const set = { "shipRocketDetails.etdCheckedAt": new Date() };
      if (etd) set["shipRocketDetails.estimatedDelivery"] = etd;
      await Order.updateOne({ _id: order._id }, { $set: set });
      if (etd) {
        await refreshOrderDeliveryEta(order._id);
        updated += 1;
      }
    } catch (error) {
      logger.warn("[shiprocketEtaRefreshJob] tracking lookup failed", {
        orderId: order.orderId,
        error: error.message,
      });
    }
  }

  if (orders.length) {
    logger.info("[shiprocketEtaRefreshJob] completed", { checked: orders.length, updated });
  }
}

export function getShiprocketEtaRefreshJobHandler() {
  return refreshShiprocketEtas;
}

export function getShiprocketEtaRefreshJobInterval() {
  return parseInt(process.env.SHIPROCKET_ETA_REFRESH_INTERVAL_MS || `${DEFAULT_INTERVAL_MS}`, 10);
}

export function isShiprocketEtaRefreshJobEnabled() {
  const email = process.env.SHIPROCKET_EMAIL;
  return Boolean(email && email !== "your_shiprocket_email");
}
