import Order from "../models/order.js";
import Admin from "../models/admin.js";
import {
  COD_ADVANCE_STATUS,
  OWNER_TYPE,
  PAYOUT_TYPE,
} from "../constants/finance.js";
import { getOrCreateFinanceSettings } from "./finance/financeSettingsService.js";
import { recordCodAdvanceRefund } from "./finance/orderFinanceService.js";
import { createPendingPayoutForOrder } from "./finance/payoutService.js";
import { createFinanceAuditLog } from "./finance/auditLogService.js";
import {
  getCodAdvanceRefundStatus,
  refundCodAdvanceToSource,
} from "./paymentService.js";
import {
  emitOrderStatusUpdate,
  emitToAllAdmins,
  emitToSeller,
} from "./orderSocketEmitter.js";
import { emitNotificationEvent } from "../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";
import logger from "./logger.js";

/**
 * COD advance after cancellation.
 *
 * When an order whose COD advance was paid gets cancelled (by anyone), the
 * advance is neither refunded nor kept automatically. The fulfiller decides:
 * the seller for seller orders, the admin for warehouse orders (admins can
 * also decide any order). "Refund" returns the money to the customer's
 * original payment source through the gateway; "Keep" retains it, crediting
 * it to the seller as a payout when a seller fulfilled the order. If nobody
 * decides before the deadline (Fees & Charges → COD advance), it is refunded.
 */

export const COD_ADVANCE_DECISION = { REFUND: "REFUND", KEEP: "KEEP" };

const DECISION_SOCKET_EVENT = "order:cod-advance:decision";
const DECIDED_SOCKET_EVENT = "order:cod-advance:decided";

function decisionAlertPayload(order) {
  return {
    orderId: order.orderId,
    amount: Number(order.codAdvance?.amount || 0),
    status: order.codAdvance?.status,
    refundFailureReason: order.codAdvance?.refundFailureReason || "",
    decisionBy: order.codAdvance?.decisionBy,
    decisionDeadline: order.codAdvance?.decisionDeadline,
    cancelledBy: order.cancelledBy || null,
    cancelReason: order.cancelReason || "",
    customerName: order.address?.name || "",
  };
}

function publicAdvance(order) {
  const advance = order.codAdvance || {};
  return {
    orderId: order.orderId,
    codAdvance: {
      amount: advance.amount,
      status: advance.status,
      decision: advance.decision,
      decidedAt: advance.decidedAt,
      refundStatus: advance.refundStatus,
    },
  };
}

/**
 * Called from every cancellation path (compensateOrderCancellation). Puts a
 * paid advance up for a decision and alerts the seller / admins.
 */
export async function requestCodAdvanceDecision(orderId) {
  const settings = await getOrCreateFinanceSettings();
  const now = new Date();
  const deadline = new Date(now.getTime() + settings.codAdvanceDecisionHours * 60 * 60 * 1000);

  const current = await Order.findById(orderId).select("seller").lean();
  if (!current) return null;

  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      "financeFlags.codAdvanceCaptured": true,
      "codAdvance.status": COD_ADVANCE_STATUS.PAID,
    },
    {
      $set: {
        "codAdvance.status": COD_ADVANCE_STATUS.DECISION_PENDING,
        "codAdvance.decisionBy": current.seller ? "SELLER" : "ADMIN",
        "codAdvance.decisionRequestedAt": now,
        "codAdvance.decisionDeadline": deadline,
      },
    },
    { new: true },
  );
  if (!order) return null;

  const payload = decisionAlertPayload(order);
  if (order.seller) {
    emitToSeller(order.seller, { event: DECISION_SOCKET_EVENT, payload });
  }
  emitToAllAdmins({ event: DECISION_SOCKET_EVENT, payload });

  const admins = order.seller ? [] : await Admin.find({}).select("_id").lean();
  emitNotificationEvent(NOTIFICATION_EVENTS.COD_ADVANCE_DECISION_REQUIRED, {
    orderId: order.orderId,
    amount: payload.amount,
    sellerId: order.seller || undefined,
    adminIds: admins.map((admin) => admin._id),
  });
  emitOrderStatusUpdate(order.orderId, publicAdvance(order), order.customer);

  logger.info("[codAdvance] decision requested", {
    orderId: order.orderId,
    decisionBy: order.codAdvance.decisionBy,
    deadline,
  });
  return order;
}

function assertCanDecide(order, actor) {
  if (actor.role === "admin" || actor.role === "system") return;
  if (
    actor.role === "seller" &&
    order.seller &&
    String(order.seller) === String(actor.id)
  ) {
    return;
  }
  const err = new Error("You are not allowed to decide this order's advance");
  err.statusCode = 403;
  throw err;
}

async function issueRefund(order, { actor, reason }) {
  try {
    const result = await refundCodAdvanceToSource(order, { reason });
    return await recordCodAdvanceRefund(order._id, {
      refundId: result.refundId,
      refundStatus: result.status,
      actorId: actor.role === "system" ? null : actor.id,
      actorType: actor.role === "seller" ? OWNER_TYPE.SELLER : OWNER_TYPE.ADMIN,
    });
  } catch (error) {
    logger.error("[codAdvance] refund failed", { orderId: order.orderId, error: error.message });
    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          "codAdvance.status": COD_ADVANCE_STATUS.REFUND_FAILED,
          "codAdvance.refundFailureReason": error.message,
        },
      },
    );
    const err = new Error(`Refund could not be issued: ${error.message}`);
    err.statusCode = error.statusCode && error.statusCode < 500 ? error.statusCode : 502;
    throw err;
  }
}

async function retainAdvance(order, { actor }) {
  const amount = Number(order.codAdvance?.amount || 0);
  // The advance was captured into the platform account; when a seller
  // fulfilled the order it is theirs to keep, so it is paid out to them.
  if (order.seller && amount > 0) {
    await createPendingPayoutForOrder({
      order,
      payoutType: PAYOUT_TYPE.SELLER,
      beneficiaryId: order.seller,
      amount,
      remarks: "COD advance retained on cancelled order.",
      metadata: { flow: "cod_advance_retained" },
    });
  }
  await createFinanceAuditLog({
    action: "COD_ADVANCE_DECIDED",
    actorType: actor.role === "seller" ? OWNER_TYPE.SELLER : OWNER_TYPE.ADMIN,
    actorId: actor.role === "system" ? null : actor.id,
    orderId: order._id,
    metadata: { decision: COD_ADVANCE_DECISION.KEEP, amount },
  });
  return Order.findByIdAndUpdate(
    order._id,
    { $set: { "codAdvance.status": COD_ADVANCE_STATUS.RETAINED } },
    { new: true },
  );
}

/**
 * Seller/admin decision on a cancelled order's advance.
 * `actor` is { role: "seller" | "admin" | "system", id }.
 * Admins may also retry a refund that failed at the gateway.
 */
export async function decideCodAdvance({ orderId, action, note = "", actor }) {
  const decision = String(action || "").toUpperCase();
  if (!COD_ADVANCE_DECISION[decision]) {
    const err = new Error("action must be REFUND or KEEP");
    err.statusCode = 400;
    throw err;
  }

  const existing = await Order.findOne({ orderId });
  if (!existing) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }
  assertCanDecide(existing, actor);

  const isRetry =
    existing.codAdvance?.status === COD_ADVANCE_STATUS.REFUND_FAILED &&
    decision === COD_ADVANCE_DECISION.REFUND &&
    (actor.role === "admin" || actor.role === "system");
  const claimableStatuses = isRetry
    ? [COD_ADVANCE_STATUS.REFUND_FAILED]
    : [COD_ADVANCE_STATUS.DECISION_PENDING];

  // Claim the decision so two people (or the auto-refund job) cannot both act.
  const claimed = await Order.findOneAndUpdate(
    { _id: existing._id, "codAdvance.status": { $in: claimableStatuses } },
    {
      $set: {
        "codAdvance.status":
          decision === COD_ADVANCE_DECISION.REFUND
            ? COD_ADVANCE_STATUS.REFUND_PENDING
            : COD_ADVANCE_STATUS.RETAINED,
        "codAdvance.decision": decision,
        "codAdvance.decidedAt": new Date(),
        "codAdvance.decidedByRole": actor.role,
        "codAdvance.decidedById": actor.role === "system" ? null : actor.id,
        "codAdvance.decisionNote": String(note || "").slice(0, 500),
      },
    },
    { new: true },
  );
  if (!claimed) {
    const err = new Error("This advance has already been decided");
    err.statusCode = 409;
    throw err;
  }

  const reason = `COD advance refund for cancelled order ${claimed.orderId}`;
  const updated =
    decision === COD_ADVANCE_DECISION.REFUND
      ? await issueRefund(claimed, { actor, reason })
      : await retainAdvance(claimed, { actor });

  const amount = Number(updated.codAdvance?.amount || 0);
  emitNotificationEvent(NOTIFICATION_EVENTS.COD_ADVANCE_OUTCOME, {
    orderId: updated.orderId,
    customerId: updated.customer,
    userId: updated.customer,
    amount,
    outcome: decision,
  });
  emitOrderStatusUpdate(updated.orderId, publicAdvance(updated), updated.customer);
  const decidedPayload = { orderId: updated.orderId, decision, status: updated.codAdvance?.status };
  if (updated.seller) emitToSeller(updated.seller, { event: DECIDED_SOCKET_EVENT, payload: decidedPayload });
  emitToAllAdmins({ event: DECIDED_SOCKET_EVENT, payload: decidedPayload });

  return updated;
}

/** Orders waiting for this seller's (or, for admins, anyone's) decision. */
export async function listPendingCodAdvanceDecisions({ role, id }) {
  const filter = {
    "codAdvance.status": {
      $in: [COD_ADVANCE_STATUS.DECISION_PENDING, COD_ADVANCE_STATUS.REFUND_FAILED],
    },
  };
  if (role === "seller") {
    filter.seller = id;
    filter["codAdvance.status"] = COD_ADVANCE_STATUS.DECISION_PENDING;
  }
  return Order.find(filter)
    .select("orderId seller fulfilledBy address.name codAdvance cancelledBy cancelReason paymentBreakdown.grandTotal updatedAt")
    .sort({ "codAdvance.decisionDeadline": 1 })
    .limit(200)
    .lean();
}

/** Refunds every advance whose decision deadline has passed. */
export async function autoRefundExpiredCodAdvanceDecisions() {
  const expired = await Order.find({
    "codAdvance.status": COD_ADVANCE_STATUS.DECISION_PENDING,
    "codAdvance.decisionDeadline": { $lte: new Date() },
  })
    .select("orderId")
    .limit(50)
    .lean();

  for (const row of expired) {
    try {
      await decideCodAdvance({
        orderId: row.orderId,
        action: COD_ADVANCE_DECISION.REFUND,
        note: "No decision before the deadline; refunded automatically.",
        actor: { role: "system", id: null },
      });
    } catch (error) {
      logger.warn("[codAdvance] auto-refund failed", { orderId: row.orderId, error: error.message });
    }
  }
  return expired.length;
}

/** Moves REFUND_PENDING advances to REFUNDED / REFUND_FAILED from the gateway. */
export async function syncPendingCodAdvanceRefunds() {
  const pending = await Order.find({
    "codAdvance.status": COD_ADVANCE_STATUS.REFUND_PENDING,
    "codAdvance.refundId": { $ne: null },
  })
    .limit(50);

  for (const order of pending) {
    try {
      const status = await getCodAdvanceRefundStatus(order);
      if (status === "processed") {
        order.set({
          "codAdvance.status": COD_ADVANCE_STATUS.REFUNDED,
          "codAdvance.refundStatus": status,
          "codAdvance.refundedAt": new Date(),
        });
        await order.save();
        emitNotificationEvent(NOTIFICATION_EVENTS.REFUND_COMPLETED, {
          orderId: order.orderId,
          customerId: order.customer,
          userId: order.customer,
        });
        emitOrderStatusUpdate(order.orderId, publicAdvance(order), order.customer);
      } else if (status === "failed") {
        order.set({
          "codAdvance.status": COD_ADVANCE_STATUS.REFUND_FAILED,
          "codAdvance.refundStatus": status,
          "codAdvance.refundFailureReason": "Gateway reported the refund as failed",
        });
        await order.save();
        emitToAllAdmins({ event: DECISION_SOCKET_EVENT, payload: decisionAlertPayload(order) });
      }
    } catch (error) {
      logger.warn("[codAdvance] refund status check failed", {
        orderId: order.orderId,
        error: error.message,
      });
    }
  }
  return pending.length;
}
