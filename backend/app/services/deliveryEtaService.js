import Order from "../models/order.js";
import Delivery from "../models/delivery.js";
import { WORKFLOW_STATUS } from "../constants/orderWorkflow.js";
import { distanceMeters } from "../utils/geoUtils.js";
import { ADMIN_FULFILLER, getFulfillmentWarehouse } from "./fulfillmentRoutingService.js";
import { emitOrderEtaUpdate } from "./orderSocketEmitter.js";
import logger from "./logger.js";

/**
 * Customer-facing delivery time.
 *
 * Customers only ever see *when* an order arrives, never how (rider,
 * courier, local store or warehouse). Everything here produces a
 * `{ earliestAt, latestAt, confidence }` window; `source` stays internal.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// City riding assumptions for distance-based estimates.
const ROAD_FACTOR = 1.3;
const AVG_SPEED_KMH = 20;
const PREP_MINUTES = 10;
const ACCEPT_MINUTES = 5;
const RIDER_TO_PICKUP_GUESS_MINUTES = 10;
const DEFAULT_TRAVEL_MINUTES = 30;

function toLatLng(value) {
  if (!value) return null;
  if (Array.isArray(value.coordinates) && value.coordinates.length >= 2) {
    const [lng, lat] = value.coordinates.map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) return { lat, lng };
    return null;
  }
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) return { lat, lng };
  return null;
}

export function estimateTravelMinutes(from, to) {
  const a = toLatLng(from);
  const b = toLatLng(to);
  if (!a || !b) return null;
  const km = (distanceMeters(a.lat, a.lng, b.lat, b.lng) / 1000) * ROAD_FACTOR;
  return Math.max(5, Math.round((km / AVG_SPEED_KMH) * 60));
}

function windowFrom(now, earliestMinutes, spreadMinutes, confidence, source) {
  const earliestAt = new Date(now.getTime() + earliestMinutes * MINUTE);
  return {
    earliestAt,
    latestAt: new Date(earliestAt.getTime() + spreadMinutes * MINUTE),
    confidence,
    source,
  };
}

function daysWindow(now, warehouse, source) {
  return {
    earliestAt: new Date(now.getTime() + warehouse.standardDeliveryDaysMin * DAY),
    latestAt: new Date(now.getTime() + warehouse.standardDeliveryDaysMax * DAY),
    confidence: "estimate",
    source,
  };
}

/**
 * Pure calculation of an order's delivery window.
 *
 * @param {Object} order lean order (address, workflowStatus, deliveryType, ...)
 * @param {Object} ctx
 * @param {Date} [ctx.now]
 * @param {Object} ctx.warehouse result of getFulfillmentWarehouse()
 * @param {Object|null} ctx.pickupLocation seller shop or warehouse {lat,lng}
 * @param {Object|null} ctx.riderLocation assigned rider's last GPS {lat,lng}
 * @returns {Object|null} deliveryEta, or null when there is nothing to show
 */
export function computeDeliveryEta(order, { now = new Date(), warehouse, pickupLocation = null, riderLocation = null }) {
  if (!order) return null;
  const status = order.workflowStatus;

  if (status === WORKFLOW_STATUS.CANCELLED) return null;
  if (status === WORKFLOW_STATUS.DELIVERED) {
    const at = order.deliveredAt ? new Date(order.deliveredAt) : now;
    return { earliestAt: at, latestAt: at, confidence: "confirmed", source: "delivered" };
  }

  if (status === WORKFLOW_STATUS.SCHEDULED || status === WORKFLOW_STATUS.RESCHEDULED) {
    const base = order.rescheduledFor || order.scheduledFor;
    if (!base) return null;
    const at = new Date(base);
    return { earliestAt: at, latestAt: new Date(at.getTime() + 2 * HOUR), confidence: "estimate", source: "scheduled" };
  }

  // Courier shipment: the courier's own date once known.
  if (order.deliveryType === "SHIPROCKET" && order.shipRocketDetails?.status !== "SHIPMENT_FAILED") {
    const etd = order.shipRocketDetails?.estimatedDelivery;
    if (etd) {
      const at = new Date(etd);
      return { earliestAt: at, latestAt: at, confidence: "confirmed", source: "courier" };
    }
    return daysWindow(now, warehouse, "courier_estimate");
  }

  const customerLocation = order.address?.location;
  const lastMile = estimateTravelMinutes(pickupLocation, customerLocation) ?? DEFAULT_TRAVEL_MINUTES;

  switch (status) {
    case WORKFLOW_STATUS.OUT_FOR_DELIVERY: {
      const minutes = estimateTravelMinutes(riderLocation, customerLocation) ?? lastMile;
      return windowFrom(now, minutes, 5, "confirmed", "rider");
    }
    case WORKFLOW_STATUS.DELIVERY_ASSIGNED:
    case WORKFLOW_STATUS.PICKUP_READY: {
      const toPickup =
        status === WORKFLOW_STATUS.PICKUP_READY
          ? 0
          : estimateTravelMinutes(riderLocation, pickupLocation) ?? RIDER_TO_PICKUP_GUESS_MINUTES;
      const prep = status === WORKFLOW_STATUS.PICKUP_READY ? 0 : PREP_MINUTES;
      return windowFrom(now, toPickup + prep + lastMile, 10, "confirmed", "rider");
    }
    case WORKFLOW_STATUS.DELIVERY_SEARCH:
      return windowFrom(now, RIDER_TO_PICKUP_GUESS_MINUTES + PREP_MINUTES + lastMile, 20, "estimate", "rider_search");
    default:
      break;
  }

  // Not dispatched yet (waiting for acceptance, or accepted).
  const riderEstimateMinutes = ACCEPT_MINUTES + RIDER_TO_PICKUP_GUESS_MINUTES + PREP_MINUTES + lastMile;

  if (order.fulfilledBy === ADMIN_FULFILLER) {
    const pickup = toLatLng(pickupLocation);
    const customer = toLatLng(customerLocation);
    const withinRiderArea =
      !order.isOutOfZone &&
      pickup &&
      customer &&
      distanceMeters(pickup.lat, pickup.lng, customer.lat, customer.lng) / 1000 <=
        Number(warehouse.serviceRadiusKm || 10);
    if (withinRiderArea) {
      return {
        earliestAt: new Date(now.getTime() + riderEstimateMinutes * MINUTE),
        latestAt: new Date(now.getTime() + warehouse.localDeliveryMaxHours * HOUR),
        confidence: "estimate",
        source: "warehouse_local_estimate",
      };
    }
    return daysWindow(now, warehouse, "warehouse_courier_estimate");
  }

  return windowFrom(now, riderEstimateMinutes, 30, "estimate", "seller_estimate");
}

function sameEta(a, b) {
  if (!a || !b) return !a && !b;
  const close = (x, y) => Math.abs(new Date(x || 0).getTime() - new Date(y || 0).getTime()) < MINUTE;
  return close(a.earliestAt, b.earliestAt) && close(a.latestAt, b.latestAt) && a.confidence === b.confidence;
}

/**
 * Recalculate, persist and push an order's delivery window. Safe to call
 * after any workflow change; failures are logged, never thrown.
 */
export async function refreshOrderDeliveryEta(orderRef) {
  try {
    const query = typeof orderRef === "string" && !/^[a-f0-9]{24}$/i.test(orderRef)
      ? { orderId: orderRef }
      : { _id: orderRef?._id || orderRef };
    const order = await Order.findOne(query)
      .select("orderId customer address workflowStatus deliveryType shipRocketDetails fulfilledBy isOutOfZone deliveredAt scheduledFor rescheduledFor deliveryBoy seller deliveryEta")
      .populate("seller", "location")
      .lean();
    if (!order) return null;

    const warehouse = await getFulfillmentWarehouse();
    const pickupLocation =
      order.fulfilledBy === ADMIN_FULFILLER
        ? warehouse.hasLocation
          ? { lat: warehouse.lat, lng: warehouse.lng }
          : null
        : order.seller?.location || null;

    let riderLocation = null;
    if (order.deliveryBoy) {
      const rider = await Delivery.findById(order.deliveryBoy).select("location").lean();
      riderLocation = rider?.location || null;
    }

    const next = computeDeliveryEta(order, { warehouse, pickupLocation, riderLocation });
    if (sameEta(order.deliveryEta?.earliestAt ? order.deliveryEta : null, next)) return order.deliveryEta;

    const deliveryEta = next
      ? { ...next, updatedAt: new Date() }
      : { earliestAt: null, latestAt: null, confidence: null, source: null, updatedAt: new Date() };
    await Order.updateOne({ _id: order._id }, { $set: { deliveryEta } });
    emitOrderEtaUpdate(order.orderId, toCustomerEta(deliveryEta), order.customer);
    return deliveryEta;
  } catch (error) {
    logger.warn("[refreshOrderDeliveryEta] failed", { order: String(orderRef?._id || orderRef), error: error.message });
    return null;
  }
}

/** Customer-safe view (drops the internal `source`). */
export function toCustomerEta(deliveryEta) {
  if (!deliveryEta?.earliestAt && !deliveryEta?.latestAt) return null;
  return {
    earliestAt: deliveryEta.earliestAt,
    latestAt: deliveryEta.latestAt || deliveryEta.earliestAt,
    confidence: deliveryEta.confidence || "estimate",
    updatedAt: deliveryEta.updatedAt || null,
  };
}

/**
 * Pre-order estimate for product listings, relative to "now" (listings are
 * cached, so absolute times would go stale). Local stock means a same-day
 * rider delivery; otherwise the warehouse's standard day range.
 */
export function productDeliveryEstimate({ fromLocalSeller, warehouse }) {
  if (fromLocalSeller) {
    return { minMinutes: 30, maxMinutes: 120 };
  }
  return {
    minMinutes: Math.round(warehouse.standardDeliveryDaysMin * 24 * 60),
    maxMinutes: Math.round(warehouse.standardDeliveryDaysMax * 24 * 60),
  };
}

const SERVICEABILITY_CACHE_MS = 6 * HOUR;
const serviceabilityCache = new Map();

async function cachedCourierEtd({ pickupPostcode, deliveryPostcode, weightKg, cod }) {
  const key = `${pickupPostcode}:${deliveryPostcode}:${weightKg}:${cod ? 1 : 0}`;
  const hit = serviceabilityCache.get(key);
  if (hit && Date.now() - hit.at < SERVICEABILITY_CACHE_MS) return hit.days;
  const { checkShiprocketServiceability } = await import("../../utils/shipRocketService.js");
  const result = await checkShiprocketServiceability({ pickupPostcode, deliveryPostcode, weightKg, cod });
  // Cache the day count (not the absolute date) so it stays valid.
  const days = result?.etd
    ? Math.max(1, Math.ceil((result.etd.getTime() - Date.now()) / DAY))
    : result?.estimatedDeliveryDays ?? null;
  serviceabilityCache.set(key, { days, at: Date.now() });
  return days;
}

/**
 * Checkout-time estimate across every order in the cart. The customer sees
 * one window: from the earliest possible arrival to the latest one.
 *
 * @param {Array} entries `sellerBreakdownEntries` from the pricing snapshot
 */
export async function estimateCheckoutDelivery(entries = [], { address = {}, paymentMode = "COD", now = new Date() } = {}) {
  if (!entries.length) return null;
  const warehouse = await getFulfillmentWarehouse();
  const windows = [];

  for (const entry of entries) {
    const km = Number(entry.distanceKm || 0);
    const lastMile = km > 0 ? Math.max(5, Math.round(((km * ROAD_FACTOR) / AVG_SPEED_KMH) * 60)) : DEFAULT_TRAVEL_MINUTES;
    const riderMinutes = ACCEPT_MINUTES + RIDER_TO_PICKUP_GUESS_MINUTES + PREP_MINUTES + lastMile;

    if (entry.fulfilledBy !== ADMIN_FULFILLER) {
      windows.push(windowFrom(now, riderMinutes, 30, "estimate", "checkout"));
      continue;
    }
    if (!entry.isOutOfZone) {
      windows.push({
        earliestAt: new Date(now.getTime() + riderMinutes * MINUTE),
        latestAt: new Date(now.getTime() + warehouse.localDeliveryMaxHours * HOUR),
      });
      continue;
    }

    let days = null;
    try {
      days = await cachedCourierEtd({
        pickupPostcode: warehouse.pincode,
        deliveryPostcode: address?.pincode,
        weightKg: warehouse.packageWeightKg,
        cod: String(paymentMode).toUpperCase() === "COD",
      });
    } catch (error) {
      logger.warn("[estimateCheckoutDelivery] courier serviceability failed", { error: error.message });
    }
    if (days) {
      const at = new Date(now.getTime() + days * DAY);
      at.setHours(20, 0, 0, 0);
      windows.push({ earliestAt: at, latestAt: at });
    } else {
      windows.push(daysWindow(now, warehouse, "checkout"));
    }
  }

  return {
    earliestAt: new Date(Math.min(...windows.map((w) => new Date(w.earliestAt).getTime()))),
    latestAt: new Date(Math.max(...windows.map((w) => new Date(w.latestAt).getTime()))),
    confidence: "estimate",
  };
}

export default {
  computeDeliveryEta,
  refreshOrderDeliveryEta,
  toCustomerEta,
  productDeliveryEstimate,
  estimateCheckoutDelivery,
  estimateTravelMinutes,
};
