/**
 * posOrderService.js — Core POS order creation, editing, and deletion.
 *
 * This is the central business logic shared by both Admin and Seller
 * POS controllers. Each controller passes role-specific parameters
 * (adminNotes string, sellerId, etc.) while this service handles
 * the common order lifecycle.
 */

import mongoose from "mongoose";
import Order from "../../models/order.js";
import User from "../../models/customer.js";
import CreditTransaction from "../../models/creditTransaction.js";
import { generateUniquePublicOrderId } from "../orderIdService.js";
import { resolvePOSCustomer, isWalkInCustomer } from "./walkInCustomerService.js";
import { resolveVariant, isValidObjectId } from "./variantHelpers.js";
import { calculateInclusiveGST, resolveGSTPercent, resolveHSNCode } from "./gstUtils.js";
import { decrementVariantStock, incrementVariantStock } from "./variantStockService.js";
import Product from "../../models/product.js";

/**
 * Create a POS order (cash or credit).
 *
 * Flow (replicating geetaecommerce adminOrderController ~L1195):
 * 1. Validate customer + items + paymentMethod
 * 2. Resolve walk-in customer
 * 3. Create Order shell with POS markers
 * 4. For each line: resolve product/variant, compute inclusive GST, build item
 * 5. If Credit: paymentStatus = Pending, increment creditBalance, create CreditTransaction
 * 6. Update order totals
 * 7. After save: decrement variant stock + write POSStockLedger
 *
 * @param {Object} params
 * @param {string} params.customerId - "walk-in-customer" or ObjectId
 * @param {string} params.paymentMethod - "Cash" | "Credit" | "Online"
 * @param {string} params.paymentStatus - "Paid" | "Pending"
 * @param {Array}  params.items - Cart items
 * @param {string} params.adminNotes - POS discriminator string
 * @param {string|null} params.sellerId - Seller ID for seller POS
 * @param {string} params.createdByRole - "Admin" | "Seller"
 * @param {string} params.createdById - Admin/Seller ObjectId
 * @returns {Promise<Object>} Created order document
 */
export async function createPOSOrder({
  customerId,
  paymentMethod,
  paymentStatus,
  items,
  adminNotes,
  sellerId = null,
  createdByRole = "Admin",
  createdById,
}) {
  // ── 1. Validate ─────────────────────────────────────────────────────
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error("At least one item is required");
  }
  if (!paymentMethod || !["Cash", "Credit", "Online"].includes(paymentMethod)) {
    throw new Error("Invalid payment method. Must be Cash, Credit, or Online");
  }
  if (paymentMethod === "Credit" && isWalkInCustomer(customerId)) {
    throw new Error("Credit sales require a registered customer (not walk-in)");
  }

  // ── 2. Resolve customer ─────────────────────────────────────────────
  const customer = await resolvePOSCustomer(customerId);

  // ── 3. Generate order ID ────────────────────────────────────────────
  const orderId = await generateUniquePublicOrderId();

  // ── 4. Build order items ────────────────────────────────────────────
  let subtotal = 0;
  let totalTax = 0;
  const orderItems = [];

  for (const item of items) {
    const unitPrice = Number(item.price || item.unitPrice || 0);
    const quantity = Number(item.quantity || 1);

    // Resolve product & variant (if valid product ID)
    let product = null;
    let variant = null;
    let variantSlot = item.variantSlot || null;

    if (item.productId && isValidObjectId(item.productId)) {
      product = await Product.findById(item.productId).lean();
      if (product && item.variationId) {
        const resolved = resolveVariant(product, item.variationId);
        variant = resolved.variant;
        variantSlot = variant?.name || variant?.sku || item.variationId;
      }
    }

    // GST calculation (inclusive pricing)
    const gstPercent = Number(item.gst) || (product ? resolveGSTPercent(product, variant) : 0);
    const { total: lineTotal, gstAmount } = calculateInclusiveGST(unitPrice, quantity, gstPercent);
    const hsnCode = item.hsnCode || (product ? resolveHSNCode(product, variant) : "");

    subtotal += lineTotal;
    totalTax += gstAmount;

    orderItems.push({
      product: isValidObjectId(item.productId)
        ? new mongoose.Types.ObjectId(item.productId)
        : new mongoose.Types.ObjectId(), // Generate dummy ObjectId for quick-add items
      name: item.name || product?.name || "Custom Item",
      quantity,
      price: unitPrice,
      variantSlot,
      image: item.image || product?.mainImage || "",
      // POS extensions
      sku: item.sku || variant?.sku || product?.sku || "",
      hsnCode,
      gst: gstPercent,
      gstAmount,
      unitPrice,
      warrantyType: item.warrantyType || "",
      warrantyDuration: item.warrantyDuration || "",
    });
  }

  // ── 5. Determine payment status ─────────────────────────────────────
  let resolvedPaymentStatus = "PAID";
  let legacyPaymentStatus = "completed";

  if (paymentMethod === "Credit") {
    resolvedPaymentStatus = "CREATED"; // Pending payment
    legacyPaymentStatus = "pending";
  } else if (paymentStatus === "Pending") {
    resolvedPaymentStatus = "CREATED";
    legacyPaymentStatus = "pending";
  }

  // ── 6. Create order ─────────────────────────────────────────────────
  const order = new Order({
    orderId,
    customer: customer._id,
    seller: sellerId ? new mongoose.Types.ObjectId(sellerId) : undefined,
    items: orderItems,
    // POS markers
    adminNotes,
    posPaymentMethod: paymentMethod,
    customerName: customer.name || "",
    customerEmail: customer.email || "",
    customerPhone: customer.phone || "",
    // Address
    address: {
      type: "Other",
      name: customer.name || "POS Customer",
      address: "POS Order",
      city: "",
      phone: customer.phone || "",
    },
    // Pricing
    pricing: {
      subtotal,
      gst: totalTax,
      deliveryFee: 0,
      platformFee: 0,
      discount: 0,
      total: subtotal,
    },
    paymentBreakdown: {
      productSubtotal: subtotal,
      taxTotal: totalTax,
      grandTotal: subtotal,
    },
    // Payment
    payment: {
      method: paymentMethod === "Online" ? "online" : "cash",
      status: legacyPaymentStatus,
    },
    paymentMode: paymentMethod === "Online" ? "ONLINE" : "COD",
    paymentStatus: resolvedPaymentStatus,
    // Status — POS orders default to Delivered
    status: "delivered",
    orderStatus: "delivered",
    deliveredAt: new Date(),
    // Stock
    stockReservation: {
      status: "COMMITTED",
      reservedAt: new Date(),
    },
  });

  await order.save();

  // ── 7. Credit handling ──────────────────────────────────────────────
  if (paymentMethod === "Credit") {
    // Increment customer credit balance
    await User.findByIdAndUpdate(customer._id, {
      $inc: { creditBalance: subtotal },
    });

    // Create credit transaction
    await CreditTransaction.create({
      customer: customer._id,
      type: "Order",
      amount: subtotal,
      balanceAfter: (customer.creditBalance || 0) + subtotal,
      order: order._id,
      note: `POS Order #${orderId}`,
      createdBy: createdById,
      createdByRole,
      seller: sellerId || undefined,
    });
  }

  // ── 8. Stock deduction ──────────────────────────────────────────────
  for (const item of orderItems) {
    // Skip quick-add/custom items (the original productId wasn't a valid ObjectId)
    const originalItem = items.find(
      (i) =>
        (i.name || "") === (item.name || "") &&
        (i.quantity || 0) === (item.quantity || 0)
    );
    const originalProductId = originalItem?.productId;

    if (originalProductId && isValidObjectId(originalProductId)) {
      await decrementVariantStock({
        productId: originalProductId,
        variantId: originalItem?.variationId || null,
        quantity: item.quantity,
        source: "POS",
        orderId: order._id,
        sellerId,
        note: `POS Sale #${orderId}`,
      });
    }
  }

  return order;
}

/**
 * Delete a POS order.
 *
 * Rules (replicate source behavior):
 * - Only walk-in customer orders can be deleted
 * - Stock is NOT restored on deletion (intentional source quirk)
 * - Credit orders: reverse credit balance
 *
 * @param {string} orderDocId - Order._id
 * @returns {Promise<Object>} Deleted order
 */
export async function deletePOSOrder(orderDocId) {
  const order = await Order.findById(orderDocId);
  if (!order) {
    throw new Error("Order not found");
  }

  // Verify it's a POS order
  if (!order.adminNotes || !order.adminNotes.includes("POS")) {
    throw new Error("Only POS orders can be deleted via this endpoint");
  }

  // Verify walk-in customer
  const customer = await User.findById(order.customer).lean();
  if (customer && customer.phone !== "0000000000") {
    throw new Error("Only walk-in customer POS orders can be deleted");
  }

  // If credit order, reverse the credit balance
  if (order.posPaymentMethod === "Credit") {
    const total = order.pricing?.total || order.paymentBreakdown?.grandTotal || 0;
    if (total > 0) {
      await User.findByIdAndUpdate(order.customer, {
        $inc: { creditBalance: -total },
      });

      await CreditTransaction.create({
        customer: order.customer,
        type: "Refund",
        amount: -total,
        order: order._id,
        note: `POS Order deleted: ${order.orderId}`,
      });
    }
  }

  // Delete the order (stock NOT restored — match source behavior)
  await Order.findByIdAndDelete(orderDocId);

  return order;
}

/**
 * Update items on an existing delivered POS order (edit bill).
 *
 * Flow:
 * 1. Only for Delivered POS orders
 * 2. Restore old items stock → POSStockLedger source: ORDER_EDIT_RESTORE
 * 3. Replace items with new items
 * 4. Deduct new items stock → ORDER_EDIT_DEDUCT
 * 5. Reconcile credit balance if applicable
 *
 * @param {string} orderDocId - Order._id
 * @param {Array} newItems - New cart items
 * @param {string|null} sellerId
 * @returns {Promise<Object>} Updated order
 */
export async function updatePOSOrderItems(orderDocId, newItems, sellerId = null) {
  const order = await Order.findById(orderDocId);
  if (!order) throw new Error("Order not found");
  if (!order.adminNotes || !order.adminNotes.includes("POS")) {
    throw new Error("Only POS orders can be edited");
  }

  const oldTotal = order.pricing?.total || order.paymentBreakdown?.grandTotal || 0;

  // ── 1. Restore old stock ────────────────────────────────────────────
  for (const oldItem of order.items) {
    if (isValidObjectId(String(oldItem.product))) {
      await incrementVariantStock({
        productId: String(oldItem.product),
        variantId: oldItem.variantSlot || null,
        quantity: oldItem.quantity,
        source: "ORDER_EDIT_RESTORE",
        orderId: order._id,
        sellerId,
        note: `Edit restore for ${order.orderId}`,
      });
    }
  }

  // ── 2. Build new items ──────────────────────────────────────────────
  let subtotal = 0;
  let totalTax = 0;
  const orderItems = [];

  for (const item of newItems) {
    const unitPrice = Number(item.price || item.unitPrice || 0);
    const quantity = Number(item.quantity || 1);

    let product = null;
    let variant = null;
    let variantSlot = item.variantSlot || null;

    if (item.productId && isValidObjectId(item.productId)) {
      product = await Product.findById(item.productId).lean();
      if (product && item.variationId) {
        const resolved = resolveVariant(product, item.variationId);
        variant = resolved.variant;
        variantSlot = variant?.name || variant?.sku || item.variationId;
      }
    }

    const gstPercent = Number(item.gst) || (product ? resolveGSTPercent(product, variant) : 0);
    const { total: lineTotal, gstAmount } = calculateInclusiveGST(unitPrice, quantity, gstPercent);
    const hsnCode = item.hsnCode || (product ? resolveHSNCode(product, variant) : "");

    subtotal += lineTotal;
    totalTax += gstAmount;

    orderItems.push({
      product: isValidObjectId(item.productId)
        ? new mongoose.Types.ObjectId(item.productId)
        : new mongoose.Types.ObjectId(),
      name: item.name || product?.name || "Custom Item",
      quantity,
      price: unitPrice,
      variantSlot,
      image: item.image || product?.mainImage || "",
      sku: item.sku || variant?.sku || product?.sku || "",
      hsnCode,
      gst: gstPercent,
      gstAmount,
      unitPrice,
      warrantyType: item.warrantyType || "",
      warrantyDuration: item.warrantyDuration || "",
    });
  }

  // ── 3. Update order ─────────────────────────────────────────────────
  order.items = orderItems;
  order.pricing = {
    ...order.pricing,
    subtotal,
    gst: totalTax,
    total: subtotal,
  };
  order.paymentBreakdown = {
    ...order.paymentBreakdown,
    productSubtotal: subtotal,
    taxTotal: totalTax,
    grandTotal: subtotal,
  };

  await order.save();

  // ── 4. Deduct new stock ─────────────────────────────────────────────
  for (const item of newItems) {
    if (item.productId && isValidObjectId(item.productId)) {
      await decrementVariantStock({
        productId: item.productId,
        variantId: item.variationId || null,
        quantity: Number(item.quantity || 1),
        source: "ORDER_EDIT_DEDUCT",
        orderId: order._id,
        sellerId,
        note: `Edit deduct for ${order.orderId}`,
      });
    }
  }

  // ── 5. Reconcile credit if applicable ───────────────────────────────
  if (order.posPaymentMethod === "Credit") {
    const newTotal = subtotal;
    const diff = newTotal - oldTotal;
    if (diff !== 0) {
      await User.findByIdAndUpdate(order.customer, {
        $inc: { creditBalance: diff },
      });

      await CreditTransaction.create({
        customer: order.customer,
        type: "Adjustment",
        amount: diff,
        order: order._id,
        note: `Order edit adjustment for ${order.orderId}`,
      });
    }
  }

  return order;
}
