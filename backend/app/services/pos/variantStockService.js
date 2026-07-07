/**
 * variantStockService.js — POS stock operations with ledger audit trail.
 *
 * Every POS stock change writes a POSStockLedger row for full auditability.
 * This is separate from the existing stockService.js which handles online
 * order stock via StockHistory.
 */

import Product from "../../models/product.js";
import POSStockLedger from "../../models/posStockLedger.js";
import { resolveVariant, isValidObjectId } from "./variantHelpers.js";

/**
 * Decrement stock for a POS sale.
 *
 * @param {Object} params
 * @param {string} params.productId
 * @param {string|null} params.variantId
 * @param {number} params.quantity
 * @param {Object} params.session - Mongoose session (optional)
 * @param {string} params.source - Ledger source tag
 * @param {string|null} params.orderId - Associated order
 * @param {string|null} params.sellerId - Seller performing the operation
 * @param {string} params.note - Optional note
 * @returns {Promise<{ product: Object, variant: Object|null }>}
 */
export async function decrementVariantStock({
  productId,
  variantId,
  quantity,
  session = null,
  source = "POS",
  orderId = null,
  sellerId = null,
  note = "",
}) {
  // Quick-add items (invalid ObjectId) skip stock entirely
  if (!isValidObjectId(productId)) {
    return { product: null, variant: null };
  }

  const product = await Product.findById(productId).session(session || null);
  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  const { variant, variantId: resolvedVariantId } = resolveVariant(product, variantId);

  const opts = session ? { session } : {};

  if (variant && resolvedVariantId) {
    // Decrement variant stock + master stock
    const updated = await Product.findOneAndUpdate(
      {
        _id: productId,
        "variants._id": resolvedVariantId,
        stock: { $gte: quantity },
        "variants.stock": { $gte: quantity },
      },
      {
        $inc: {
          stock: -quantity,
          "variants.$.stock": -quantity,
        },
      },
      { new: true, ...opts }
    );

    if (!updated) {
      throw new Error(
        `Insufficient stock for ${product.name} (variant: ${variant.name || resolvedVariantId})`
      );
    }

    // Write ledger entry
    await POSStockLedger.create(
      [
        {
          product: productId,
          variant: variant.name || "",
          variantId: resolvedVariantId,
          productName: product.name,
          sku: variant.sku || product.sku || "",
          type: "OUT",
          source,
          quantity,
          order: orderId || undefined,
          seller: sellerId || undefined,
          note,
        },
      ],
      opts
    );

    return { product: updated, variant };
  } else {
    // No variant — decrement root stock only
    const updated = await Product.findOneAndUpdate(
      {
        _id: productId,
        stock: { $gte: quantity },
      },
      {
        $inc: { stock: -quantity },
      },
      { new: true, ...opts }
    );

    if (!updated) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }

    await POSStockLedger.create(
      [
        {
          product: productId,
          productName: product.name,
          sku: product.sku || "",
          type: "OUT",
          source,
          quantity,
          order: orderId || undefined,
          seller: sellerId || undefined,
          note,
        },
      ],
      opts
    );

    return { product: updated, variant: null };
  }
}

/**
 * Increment stock (restore) for POS edit/return scenarios.
 *
 * @param {Object} params - Same shape as decrementVariantStock
 * @returns {Promise<{ product: Object, variant: Object|null }>}
 */
export async function incrementVariantStock({
  productId,
  variantId,
  quantity,
  session = null,
  source = "ORDER_EDIT_RESTORE",
  orderId = null,
  sellerId = null,
  note = "",
}) {
  if (!isValidObjectId(productId)) {
    return { product: null, variant: null };
  }

  const product = await Product.findById(productId).session(session || null);
  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  const { variant, variantId: resolvedVariantId } = resolveVariant(product, variantId);
  const opts = session ? { session } : {};

  if (variant && resolvedVariantId) {
    const updated = await Product.findOneAndUpdate(
      {
        _id: productId,
        "variants._id": resolvedVariantId,
      },
      {
        $inc: {
          stock: quantity,
          "variants.$.stock": quantity,
        },
      },
      { new: true, ...opts }
    );

    await POSStockLedger.create(
      [
        {
          product: productId,
          variant: variant.name || "",
          variantId: resolvedVariantId,
          productName: product.name,
          sku: variant.sku || product.sku || "",
          type: "IN",
          source,
          quantity,
          order: orderId || undefined,
          seller: sellerId || undefined,
          note,
        },
      ],
      opts
    );

    return { product: updated, variant };
  } else {
    const updated = await Product.findOneAndUpdate(
      { _id: productId },
      { $inc: { stock: quantity } },
      { new: true, ...opts }
    );

    await POSStockLedger.create(
      [
        {
          product: productId,
          productName: product.name,
          sku: product.sku || "",
          type: "IN",
          source,
          quantity,
          order: orderId || undefined,
          seller: sellerId || undefined,
          note,
        },
      ],
      opts
    );

    return { product: updated, variant: null };
  }
}

/**
 * Get current stock for a product/variant.
 *
 * @param {string} productId
 * @param {string|null} variantId
 * @returns {Promise<number>}
 */
export async function getVariantStock(productId, variantId) {
  if (!isValidObjectId(productId)) return 0;

  const product = await Product.findById(productId).lean();
  if (!product) return 0;

  if (variantId) {
    const variant = (product.variants || []).find(
      (v) => String(v._id) === String(variantId)
    );
    return variant ? (variant.stock || 0) : 0;
  }

  return product.stock || 0;
}
