import mongoose from "mongoose";
import Order from "../models/order.js";
import { escapeRegex } from "./regex.js";

export function normalizeOrderRouteParam(raw) {
  return decodeURIComponent(String(raw ?? "")).trim();
}

function isStrictObjectIdString(s) {
  return (
    typeof s === "string" &&
    s.length === 24 &&
    mongoose.Types.ObjectId.isValid(s) &&
    new mongoose.Types.ObjectId(s).toString() === s
  );
}

/**
 * Match an order from a route/query/body param: human orderId (e.g. ORD…) or MongoDB _id (24-char hex).
 */
export function orderMatchQueryFromRouteParam(routeParam) {
  const raw = normalizeOrderRouteParam(routeParam);
  if (!raw) return null;
  if (isStrictObjectIdString(raw)) {
    return { _id: new mongoose.Types.ObjectId(raw) };
  }
  return { orderId: raw };
}

/**
 * Same as {@link orderMatchQueryFromRouteParam} but tolerates orderId case drift (e.g. ORD vs ord)
 * by matching case-insensitively when the exact string is not found.
 * Use for read endpoints (e.g. customer order detail); keep strict matching for mutating flows when needed.
 */
export function orderMatchQueryFlexible(routeParam) {
  const raw = normalizeOrderRouteParam(routeParam);
  if (!raw) return null;
  if (isStrictObjectIdString(raw)) {
    return { _id: new mongoose.Types.ObjectId(raw) };
  }
  const esc = escapeRegex(raw);
  return {
    $or: [
      { orderId: raw },
      { orderId: new RegExp(`^${esc}$`, "i") },
      { checkoutGroupId: raw },
      { checkoutGroupId: new RegExp(`^${esc}$`, "i") },
    ],
  };
}

import SellerProductRequest from "../models/sellerProductRequest.js";

export async function resolveCanonicalOrderId(routeParam) {
  const raw = normalizeOrderRouteParam(routeParam);
  if (raw && raw.toUpperCase().startsWith("REQ-")) {
    const doc = await SellerProductRequest.findOne({ requestNumber: new RegExp(`^${escapeRegex(raw)}$`, "i") }).select("requestNumber").lean();
    return doc?.requestNumber ?? null;
  }
  const q = orderMatchQueryFromRouteParam(routeParam);
  if (!q) return null;
  const doc = await Order.findOne(q);
  if (doc) {
    if (!doc.workflowVersion || doc.workflowVersion < 2 || !doc.workflowStatus) {
      doc.workflowVersion = 2;
      const { workflowFromLegacyStatus, WORKFLOW_STATUS } = await import("../constants/orderWorkflow.js");
      let targetStatus = workflowFromLegacyStatus(doc.status);
      if (targetStatus === WORKFLOW_STATUS.DELIVERY_SEARCH && doc.deliveryBoy) {
        targetStatus = WORKFLOW_STATUS.DELIVERY_ASSIGNED;
      }
      doc.workflowStatus = targetStatus;
      await doc.save();
    }
    return doc.orderId;
  }
  return null;
}

export async function requireCanonicalOrderId(routeParam) {
  const rid = await resolveCanonicalOrderId(routeParam);
  if (!rid) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }
  return rid;
}
