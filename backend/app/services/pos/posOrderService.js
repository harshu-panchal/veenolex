/**
 * posOrderService.js — Core POS order creation, editing, and deletion.
 *
 * This is the central business logic shared by both Admin and Seller
 * POS controllers. Each controller passes role-specific parameters
 * (adminNotes string, sellerId, etc.) while this service handles
 * the common order lifecycle.
 *
 * Stock: a bill and its stock deduction are written in one transaction, so
 * a line that is out of stock saves nothing. Online POS bills only check
 * availability when created and deduct once the payment is verified
 * (`deductPOSOrderStockOnce`).
 */

import mongoose from "mongoose";
import Order from "../../models/order.js";
import User from "../../models/customer.js";
import CreditTransaction from "../../models/creditTransaction.js";
import { generateUniquePublicOrderId } from "../orderIdService.js";
import { invalidateProductStockCache } from "../stockService.js";
import { resolvePOSCustomer, isWalkInCustomer } from "./walkInCustomerService.js";
import {
  resolveVariant,
  isValidObjectId,
  effectiveStock,
  findVariantByRef,
} from "./variantHelpers.js";
import { calculateInclusiveGST, resolveGSTPercent, resolveHSNCode } from "./gstUtils.js";
import {
  assertVariantStockAvailable,
  decrementVariantStock,
  incrementVariantStock,
} from "./variantStockService.js";
import { isPOSProductOwner } from "./posProductService.js";
import Product from "../../models/product.js";

const POS_STOCK_VERSION = 2;

function badRequest(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Whether this bill's stock has been taken out of inventory. Bills from
 * before stock tracking always deducted when they were created.
 */
export function wasPOSStockDeducted(order) {
  if (Number(order?.posStockVersion || 0) >= POS_STOCK_VERSION) {
    return Boolean(order.posStockDeductedAt);
  }
  return true;
}

async function runInTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * Turn cart items into order lines plus the stock movements they need.
 * Catalog products must belong to the POS owner (admin catalog for the
 * admin POS, the seller's own products for a seller POS).
 */
async function buildPOSLines(items, ownerSellerId, session) {
  let subtotal = 0;
  let totalTax = 0;
  const orderItems = [];
  const stockLines = [];

  for (const item of items) {
    const unitPrice = Number(item.price ?? item.unitPrice ?? 0);
    const quantity = Number(item.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw badRequest(`Invalid quantity for ${item.name || "item"}`);
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw badRequest(`Invalid price for ${item.name || "item"}`);
    }

    let product = null;
    let variant = null;
    let variantId = null;
    let variantSlot = item.variantSlot || null;

    if (item.productId && isValidObjectId(item.productId)) {
      product = await Product.findById(item.productId).session(session || null).lean();
      if (!product) {
        throw badRequest(`Product not found: ${item.name || item.productId}`, 404);
      }
      if (!isPOSProductOwner(product, ownerSellerId)) {
        throw badRequest(`${product.name} is not in this store's catalog`, 403);
      }
      const resolved = resolveVariant(product, item.variationId || null);
      if (item.variationId && !resolved.variant) {
        throw badRequest(`Variant not found for ${product.name}`);
      }
      if (!resolved.variant && (product.variants || []).length > 1) {
        throw badRequest(`Choose a variant for ${product.name}`);
      }
      variant = resolved.variant;
      variantId = resolved.variantId;
      if (variant) variantSlot = variant.name || variant.sku || variantId;
    }

    // GST calculation (inclusive pricing)
    const gstPercent = Number(item.gst) || (product ? resolveGSTPercent(product, variant) : 0);
    const { total: lineTotal, gstAmount } = calculateInclusiveGST(unitPrice, quantity, gstPercent);
    const hsnCode = item.hsnCode || (product ? resolveHSNCode(product, variant) : "");

    subtotal += lineTotal;
    totalTax += gstAmount;

    orderItems.push({
      // Quick-add/custom items get a placeholder id; they carry no stock.
      product: product ? product._id : new mongoose.Types.ObjectId(),
      name: item.name || product?.name || "Custom Item",
      quantity,
      price: unitPrice,
      variantSlot,
      variantId: variantId || undefined,
      stockTracked: Boolean(product),
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

    if (product) {
      stockLines.push({
        productId: String(product._id),
        variantId,
        quantity,
        name: orderItems[orderItems.length - 1].name,
      });
    }
  }

  return { orderItems, stockLines, subtotal, totalTax };
}

/** Stock movements for the tracked lines of an existing bill. */
function stockLinesFromOrderItems(order) {
  return (order.items || [])
    .filter((item) => item.stockTracked === true)
    .map((item) => ({
      productId: String(item.product),
      variantId: item.variantId || null,
      quantity: item.quantity,
      name: item.name,
    }));
}

/**
 * Bills from before stock tracking only stored the variant's name/SKU and
 * gave custom items a random product id (skipped when it matches nothing).
 */
async function legacyStockLinesFromOrderItems(order, session) {
  const lines = [];
  for (const item of order.items || []) {
    const product = await Product.findById(item.product).session(session || null).lean();
    if (!product) continue;
    const variant = findVariantByRef(product, item.variantSlot);
    lines.push({
      productId: String(product._id),
      variantId: variant ? String(variant._id) : null,
      quantity: item.quantity,
      name: item.name,
    });
  }
  return lines;
}

async function stockLinesToRestore(order, session) {
  if (!wasPOSStockDeducted(order)) return [];
  return Number(order.posStockVersion || 0) >= POS_STOCK_VERSION
    ? stockLinesFromOrderItems(order)
    : legacyStockLinesFromOrderItems(order, session);
}

function remainingAfter(product, variantId) {
  if (!product) return null;
  const variant = variantId
    ? (product.variants || []).find((v) => String(v._id) === String(variantId))
    : null;
  return effectiveStock(product, variant || null);
}

/**
 * Deduct stock for lines inside `session`. Returns the stock left per line
 * so the POS screen can show it straight away.
 */
async function deductStockLines(lines, { session, source, orderId, sellerId, note }) {
  const updates = [];
  for (const line of lines) {
    const { product } = await decrementVariantStock({
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
      session,
      source,
      orderId,
      sellerId,
      note,
    });
    updates.push({
      productId: line.productId,
      variantId: line.variantId,
      name: line.name,
      quantity: line.quantity,
      remaining: remainingAfter(product, line.variantId),
    });
  }
  return updates;
}

async function restoreStockLines(lines, { session, source, orderId, sellerId, note }) {
  const updates = [];
  for (const line of lines) {
    const { product } = await incrementVariantStock({
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
      session,
      source,
      orderId,
      sellerId,
      note,
    });
    if (product) {
      updates.push({
        productId: line.productId,
        variantId: line.variantId,
        name: line.name,
        quantity: line.quantity,
        remaining: remainingAfter(product, line.variantId),
      });
    }
  }
  return updates;
}

async function assertLinesAvailable(lines, session) {
  const totals = new Map();
  for (const line of lines) {
    const key = `${line.productId}:${line.variantId || ""}`;
    const entry = totals.get(key) || { ...line, quantity: 0 };
    entry.quantity += line.quantity;
    totals.set(key, entry);
  }
  for (const line of totals.values()) {
    await assertVariantStockAvailable({ ...line, session });
  }
}

/**
 * Validate the request and resolve what can be resolved outside the
 * transaction (customer, public order id).
 */
async function preparePOSOrder(params) {
  const { customerId, paymentMethod, items } = params;
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw badRequest("At least one item is required");
  }
  if (!paymentMethod || !["Cash", "Credit", "Online"].includes(paymentMethod)) {
    throw badRequest("Invalid payment method. Must be Cash, Credit, or Online");
  }
  if (paymentMethod === "Credit" && isWalkInCustomer(customerId)) {
    throw badRequest("Credit sales require a registered customer (not walk-in)");
  }

  const customer = await resolvePOSCustomer(customerId);
  const orderId = await generateUniquePublicOrderId();
  return { ...params, customer, orderId };
}

/**
 * Write a prepared POS bill (order, credit, stock) inside `session`.
 */
async function writePOSOrder(prepared, session) {
  const {
    customer,
    orderId,
    paymentMethod,
    paymentStatus,
    items,
    adminNotes,
    sellerId = null,
    createdByRole = "Admin",
    createdById,
  } = prepared;

  const { orderItems, stockLines, subtotal, totalTax } = await buildPOSLines(items, sellerId, session);

  // Online POS bills are paid on the customer's phone afterwards: only
  // check stock now, deduct once the payment is verified.
  const deductNow = !(paymentMethod === "Online" && paymentStatus === "Pending");
  if (!deductNow) {
    await assertLinesAvailable(stockLines, session);
  }

  let resolvedPaymentStatus = "PAID";
  let legacyPaymentStatus = "completed";
  if (paymentMethod === "Credit" || paymentStatus === "Pending") {
    resolvedPaymentStatus = "CREATED"; // Pending payment
    legacyPaymentStatus = "pending";
  }

  const order = new Order({
    orderId,
    customer: customer._id,
    seller: sellerId ? new mongoose.Types.ObjectId(sellerId) : undefined,
    items: orderItems,
    // POS markers
    adminNotes,
    posPaymentMethod: paymentMethod,
    posStockVersion: POS_STOCK_VERSION,
    posStockDeductedAt: deductNow ? new Date() : null,
    customerName: customer.name || "",
    customerEmail: customer.email || "",
    customerPhone: customer.phone || "",
    address: {
      type: "Other",
      name: customer.name || "POS Customer",
      address: "POS Order",
      city: "",
      phone: customer.phone || "",
    },
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
    stockReservation: {
      status: "COMMITTED",
      reservedAt: new Date(),
    },
  });

  await order.save({ session });

  if (paymentMethod === "Credit") {
    await User.findByIdAndUpdate(customer._id, { $inc: { creditBalance: subtotal } }, { session });
    await CreditTransaction.create(
      [
        {
          customer: customer._id,
          type: "Order",
          amount: subtotal,
          balanceAfter: (customer.creditBalance || 0) + subtotal,
          order: order._id,
          note: `POS Order #${orderId}`,
          createdBy: createdById,
          createdByRole,
          seller: sellerId || undefined,
        },
      ],
      { session },
    );
  }

  const stockUpdates = deductNow
    ? await deductStockLines(stockLines, {
      session,
      source: "POS",
      orderId: order._id,
      sellerId,
      note: `POS Sale #${orderId}`,
    })
    : [];

  return { order, stockUpdates };
}

/**
 * Create a POS order (cash, credit, or online).
 *
 * Cash/Credit bills deduct stock immediately; an online bill created as
 * Pending only checks availability (see `deductPOSOrderStockOnce`).
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
 * @returns {Promise<{ order: Object, stockUpdates: Array }>}
 */
export async function createPOSOrder(params) {
  const prepared = await preparePOSOrder(params);
  const result = await runInTransaction((session) => writePOSOrder(prepared, session));
  void invalidateProductStockCache(result.stockUpdates.map((u) => u.productId));
  return result;
}

/**
 * Exchange: return items from an earlier bill and sell new ones, as one
 * transaction (if a new item is out of stock, nothing is returned either).
 *
 * @returns {Promise<{ order: Object, stockUpdates: Array }>}
 */
export async function exchangePOSItems({ originalOrder, returnItems = [], ...params }) {
  const prepared = await preparePOSOrder(params);
  const ownerSellerId = originalOrder.seller ? String(originalOrder.seller) : null;

  // Returned quantities can't exceed what the original bill sold.
  const sold = new Map();
  for (const item of originalOrder.items || []) {
    const key = String(item.product);
    sold.set(key, (sold.get(key) || 0) + Number(item.quantity || 0));
  }
  const returning = new Map();
  for (const item of returnItems) {
    if (!item.productId || !isValidObjectId(item.productId)) continue;
    const key = String(item.productId);
    returning.set(key, (returning.get(key) || 0) + Number(item.quantity || 1));
    if (returning.get(key) > (sold.get(key) || 0)) {
      throw badRequest(`Cannot return more ${item.name || "units"} than were sold on ${originalOrder.orderId}`);
    }
  }

  const result = await runInTransaction(async (session) => {
    const restored = wasPOSStockDeducted(originalOrder)
      ? await restoreStockLines(
        returnItems
          .filter((item) => item.productId && isValidObjectId(item.productId))
          .map((item) => ({
            productId: String(item.productId),
            variantId: item.variationId || null,
            quantity: Number(item.quantity || 1),
            name: item.name,
          })),
        {
          session,
          source: "ORDER_EDIT_RESTORE",
          orderId: originalOrder._id,
          sellerId: ownerSellerId,
          note: `Exchange return from ${originalOrder.orderId}`,
        },
      )
      : [];
    const written = await writePOSOrder({ ...prepared, sellerId: ownerSellerId }, session);
    return { ...written, stockUpdates: [...restored, ...written.stockUpdates] };
  });

  void invalidateProductStockCache(result.stockUpdates.map((u) => u.productId));
  return result;
}

/**
 * Deduct an online POS bill's stock once its payment is verified. Safe to
 * call repeatedly: only the first successful call deducts.
 *
 * @returns {Promise<{ stockUpdates: Array, stockError: string|null }>}
 */
export async function deductPOSOrderStockOnce(orderDocId) {
  try {
    const stockUpdates = await runInTransaction(async (session) => {
      const order = await Order.findOneAndUpdate(
        { _id: orderDocId, posStockVersion: POS_STOCK_VERSION, posStockDeductedAt: null },
        { $set: { posStockDeductedAt: new Date() } },
        { new: true, session },
      );
      if (!order) return []; // already deducted, or a bill from before tracking
      return deductStockLines(stockLinesFromOrderItems(order), {
        session,
        source: "POS",
        orderId: order._id,
        sellerId: order.seller || null,
        note: `POS Sale #${order.orderId}`,
      });
    });
    void invalidateProductStockCache(stockUpdates.map((u) => u.productId));
    return { stockUpdates, stockError: null };
  } catch (error) {
    if (error.code === "INSUFFICIENT_STOCK" || error.statusCode === 409) {
      return { stockUpdates: [], stockError: error.message };
    }
    throw error;
  }
}

/**
 * Delete a POS order.
 *
 * Rules:
 * - Only walk-in customer orders can be deleted
 * - Stock that the bill took out is put back
 * - Credit orders: reverse credit balance
 *
 * @param {string} orderDocId - Order._id
 * @returns {Promise<Object>} Deleted order
 */
export async function deletePOSOrder(orderDocId) {
  const order = await Order.findById(orderDocId);
  if (!order) {
    throw badRequest("Order not found", 404);
  }

  // Verify it's a POS order
  if (!order.adminNotes || !order.adminNotes.includes("POS")) {
    throw badRequest("Only POS orders can be deleted via this endpoint");
  }

  // Verify walk-in customer
  const customer = await User.findById(order.customer).lean();
  if (customer && customer.phone !== "0000000000") {
    throw badRequest("Only walk-in customer POS orders can be deleted");
  }

  const restoredIds = await runInTransaction(async (session) => {
    if (order.posPaymentMethod === "Credit") {
      const total = order.pricing?.total || order.paymentBreakdown?.grandTotal || 0;
      if (total > 0) {
        await User.findByIdAndUpdate(order.customer, { $inc: { creditBalance: -total } }, { session });
        await CreditTransaction.create(
          [
            {
              customer: order.customer,
              type: "Refund",
              amount: -total,
              order: order._id,
              note: `POS Order deleted: ${order.orderId}`,
            },
          ],
          { session },
        );
      }
    }

    const restored = await restoreStockLines(await stockLinesToRestore(order, session), {
      session,
      source: "ORDER_DELETE_RESTORE",
      orderId: order._id,
      sellerId: order.seller || null,
      note: `POS bill deleted: ${order.orderId}`,
    });

    await Order.deleteOne({ _id: order._id }, { session });
    return restored.map((u) => u.productId);
  });

  void invalidateProductStockCache(restoredIds);
  return order;
}

/**
 * Update items on an existing POS order (edit bill).
 *
 * In one transaction: put back the old lines' stock, take out the new
 * lines' stock, reconcile credit. A bill whose stock was never deducted
 * (online, not yet paid) only gets its lines replaced.
 *
 * @param {string} orderDocId - Order._id
 * @param {Array} newItems - New cart items
 * @returns {Promise<{ order: Object, stockUpdates: Array }>}
 */
export async function updatePOSOrderItems(orderDocId, newItems) {
  if (!Array.isArray(newItems) || newItems.length === 0) {
    throw badRequest("At least one item is required");
  }

  const result = await runInTransaction(async (session) => {
    const order = await Order.findById(orderDocId).session(session);
    if (!order) throw badRequest("Order not found", 404);
    if (!order.adminNotes || !order.adminNotes.includes("POS")) {
      throw badRequest("Only POS orders can be edited");
    }

    const ownerSellerId = order.seller ? String(order.seller) : null;
    const stockWasDeducted = wasPOSStockDeducted(order);
    const oldTotal = order.pricing?.total || order.paymentBreakdown?.grandTotal || 0;

    const restored = await restoreStockLines(await stockLinesToRestore(order, session), {
      session,
      source: "ORDER_EDIT_RESTORE",
      orderId: order._id,
      sellerId: ownerSellerId,
      note: `Edit restore for ${order.orderId}`,
    });

    const { orderItems, stockLines, subtotal, totalTax } = await buildPOSLines(newItems, ownerSellerId, session);

    order.items = orderItems;
    order.posStockVersion = POS_STOCK_VERSION;
    order.posStockDeductedAt = stockWasDeducted ? (order.posStockDeductedAt || new Date()) : null;
    order.set({
      "pricing.subtotal": subtotal,
      "pricing.gst": totalTax,
      "pricing.total": subtotal,
      "paymentBreakdown.productSubtotal": subtotal,
      "paymentBreakdown.taxTotal": totalTax,
      "paymentBreakdown.grandTotal": subtotal,
    });
    await order.save({ session });

    const deducted = stockWasDeducted
      ? await deductStockLines(stockLines, {
        session,
        source: "ORDER_EDIT_DEDUCT",
        orderId: order._id,
        sellerId: ownerSellerId,
        note: `Edit deduct for ${order.orderId}`,
      })
      : [];

    if (order.posPaymentMethod === "Credit") {
      const diff = subtotal - oldTotal;
      if (diff !== 0) {
        await User.findByIdAndUpdate(order.customer, { $inc: { creditBalance: diff } }, { session });
        await CreditTransaction.create(
          [
            {
              customer: order.customer,
              type: "Adjustment",
              amount: diff,
              order: order._id,
              note: `Order edit adjustment for ${order.orderId}`,
            },
          ],
          { session },
        );
      }
    }

    return { order, stockUpdates: [...restored, ...deducted] };
  });

  void invalidateProductStockCache(result.stockUpdates.map((u) => u.productId));
  return result;
}
