const fs = require('fs');

const servicePath = '/Users/prathmesh/Documents/GitHub/veenolex/backend/app/services/orderWorkflowService.js';
let content = fs.readFileSync(servicePath, 'utf8');

// Replace Delivery Accept logic
const acceptLogicStart = "export async function deliveryAcceptAtomic(deliveryId, orderId, idempotencyKey) {";
const acceptLogicEnd = "return { order: updated, duplicate: false };\n}";

const oldAcceptLogic = content.substring(content.indexOf(acceptLogicStart), content.indexOf(acceptLogicEnd) + acceptLogicEnd.length);

const newAcceptLogic = `export async function deliveryAcceptAtomic(deliveryId, orderId, idempotencyKey) {
  orderId = await requireCanonicalOrderId(orderId);
  const deliveryOid = toDeliveryObjectId(deliveryId);
  if (!deliveryOid) {
    const err = new Error("Invalid delivery account");
    err.statusCode = 400;
    throw err;
  }

  if (idempotencyKey) {
    try {
      const redis = getRedisClient();
      if (redis) {
        const cacheKey = \`idem:delivery_accept:\${orderId}:\${idempotencyKey}\`;
        const hit = await redis.get(cacheKey);
        if (hit) {
          const isReq = orderId.startsWith("REQ");
          const Model = isReq ? SellerProductRequest : Order;
          const order = await Model.findOne(isReq ? { requestNumber: orderId } : { orderId }).lean();
          return { order, duplicate: true };
        }
      }
    } catch {
      /* idempotency optional if Redis unavailable */
    }
  }

  const now = new Date();
  let updated;
  
  if (orderId.startsWith("REQ")) {
    updated = await SellerProductRequest.findOneAndUpdate(
      {
        requestNumber: orderId,
        deliveryWorkflowStatus: WORKFLOW_STATUS.DELIVERY_SEARCH,
        deliveryBoy: null,
        deliverySearchExpiresAt: { $gt: now },
      },
      {
        $set: {
          deliveryBoy: deliveryOid,
          deliveryWorkflowStatus: WORKFLOW_STATUS.DELIVERY_ASSIGNED,
          assignedAt: now,
          deliveryRiderStep: 1,
        },
        $inc: { assignmentVersion: 1 },
      },
      { new: true }
    );
  } else {
    updated = await Order.findOneAndUpdate(
      {
        orderId,
        workflowVersion: { $gte: 2 },
        workflowStatus: WORKFLOW_STATUS.DELIVERY_SEARCH,
        deliveryBoy: null,
        deliverySearchExpiresAt: { $gt: now },
        skippedBy: { $nin: [deliveryOid] },
      },
      {
        $set: {
          deliveryBoy: deliveryOid,
          workflowStatus: WORKFLOW_STATUS.DELIVERY_ASSIGNED,
          status: legacyStatusFromWorkflow(WORKFLOW_STATUS.DELIVERY_ASSIGNED),
          assignedAt: now,
          deliveryRiderStep: 1,
        },
        $inc: { assignmentVersion: 1 },
      },
      { new: true }
    );
  }

  if (!updated) {
    const isReq = orderId.startsWith("REQ");
    const Model = isReq ? SellerProductRequest : Order;
    const o = await Model.findOne(isReq ? { requestNumber: orderId } : { orderId }).lean();
    
    if (!o) {
      const err = new Error("Order not found");
      err.statusCode = 404;
      throw err;
    }
    let msg = "Order already assigned or not available";
    const statusField = isReq ? o.deliveryWorkflowStatus : o.workflowStatus;
    
    if (o.deliverySearchExpiresAt && new Date(o.deliverySearchExpiresAt) <= now) {
      msg = "Accept window has expired. Wait for the next delivery request.";
    } else if (o.deliveryBoy) {
      msg = "Another rider already accepted this order.";
    } else if (
      !isReq && (o.skippedBy || []).some((id) => id.toString() === deliveryOid.toString())
    ) {
      msg = "You rejected this order earlier, so it cannot be accepted now.";
    } else if (statusField !== WORKFLOW_STATUS.DELIVERY_SEARCH) {
      msg = "This order is no longer open for delivery.";
    }
    const err = new Error(msg);
    err.statusCode = 409;
    throw err;
  }

  if (!orderId.startsWith("REQ")) {
    await removeDeliveryTimeoutJob(orderId, updated.deliverySearchMeta?.attempt || 1);
  }

  const lastBroadcast = await DeliveryAssignment.findOne({
    orderId,
    status: "broadcasting",
  }).sort({ createdAt: -1 });
  
  if (lastBroadcast) {
    lastBroadcast.status = "assigned";
    lastBroadcast.winnerDeliveryId = deliveryOid;
    await lastBroadcast.save();
  }

  if (idempotencyKey) {
    try {
      const redis = getRedisClient();
      if (redis) {
        await redis.set(
          \`idem:delivery_accept:\${orderId}:\${idempotencyKey}\`,
          "1",
          "EX",
          86400,
        );
      }
    } catch {
      /* ignore */
    }
  }

  if (!orderId.startsWith("REQ")) {
    emitNotificationEvent(NOTIFICATION_EVENTS.DELIVERY_ASSIGNED, {
      orderId: updated.orderId,
      deliveryId: deliveryOid,
      customerId: updated.customer,
      sellerId: updated.seller,
    });
  }

  await retractDeliveryBroadcastForOrder(orderId, deliveryOid);

  if (!orderId.startsWith("REQ")) {
    emitOrderStatusUpdate(
      updated.orderId,
      {
        workflowStatus: WORKFLOW_STATUS.DELIVERY_ASSIGNED,
        deliveryBoyId: deliveryOid.toString(),
      },
      updated.customer,
    );
  } else {
    // For requests, emit to seller if needed.
    // Assuming emitOrderStatusUpdate isn't required for B2B yet
  }

  return { order: updated, duplicate: false };
}`;

content = content.replace(oldAcceptLogic, newAcceptLogic);
fs.writeFileSync(servicePath, content);
console.log("Patched deliveryAcceptAtomic");
