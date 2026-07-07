/**
 * variantHelpers.js — Utility functions for working with product variants.
 *
 * Ported from geetaecommerce's variantHelpers.ts to plain JavaScript.
 * Handles variant extraction, lookup, and auto-resolution for POS flows.
 */

/**
 * Extract variant rows from a product document.
 * Returns an array of variant objects, each with product-level defaults
 * applied for any missing variant-specific fields.
 *
 * @param {Object} product - Mongoose product document (plain or lean)
 * @returns {Array} Array of variant objects with resolved fields
 */
export function variantsFromProductDoc(product) {
  if (!product) return [];

  const variants = product.variants || [];
  if (variants.length === 0) {
    // Product has no variants — return a single "virtual" variant
    // representing the root product itself.
    return [
      {
        _id: null,
        name: product.name || "",
        sku: product.sku || "",
        price: product.price || 0,
        salePrice: product.salePrice || 0,
        discPrice: product.salePrice || 0,
        purchasePrice: 0,
        wholesalePrice: 0,
        compareAtPrice: product.price || 0,
        stock: product.stock || 0,
        barcode: product.barcode || [],
        mainImage: product.mainImage || "",
        isVirtual: true,
      },
    ];
  }

  return variants.map((v) => ({
    _id: v._id ? String(v._id) : null,
    name: v.name || "",
    sku: v.sku || product.sku || "",
    price: v.price ?? product.price ?? 0,
    salePrice: v.salePrice ?? product.salePrice ?? 0,
    discPrice: v.discPrice ?? v.salePrice ?? product.salePrice ?? 0,
    purchasePrice: v.purchasePrice ?? 0,
    wholesalePrice: v.wholesalePrice ?? 0,
    compareAtPrice: v.compareAtPrice ?? v.price ?? product.price ?? 0,
    stock: v.stock ?? 0,
    barcode: v.barcode || product.barcode || [],
    mainImage: v.mainImage || product.mainImage || "",
    isVirtual: false,
  }));
}

/**
 * Find a specific variant by its _id within a product.
 *
 * @param {Object} product - Product document
 * @param {string} variantId - The variant _id to find
 * @returns {Object|null} The matching variant subdocument, or null
 */
export function findVariantById(product, variantId) {
  if (!product || !variantId) return null;
  const variants = product.variants || [];
  return variants.find((v) => String(v._id) === String(variantId)) || null;
}

/**
 * Auto-resolve variant for POS operations.
 *
 * Rules (replicate source behavior):
 * 1. If variantId is provided, use it
 * 2. If product has exactly 1 variant and no variantId sent, auto-select it
 * 3. If product has no variants, return null (root product stock)
 *
 * @param {Object} product - Product document
 * @param {string|null} variantId - Optional variant ID from request
 * @returns {{ variant: Object|null, variantId: string|null }}
 */
export function resolveVariant(product, variantId) {
  if (!product) return { variant: null, variantId: null };

  const variants = product.variants || [];

  // Explicit variant ID provided
  if (variantId) {
    const variant = findVariantById(product, variantId);
    return { variant, variantId: variant ? String(variant._id) : null };
  }

  // Auto-resolve single variant
  if (variants.length === 1) {
    const variant = variants[0];
    return { variant, variantId: String(variant._id) };
  }

  // No variants or multiple variants without selection
  return { variant: null, variantId: null };
}

/**
 * Check if a product ID string is a valid MongoDB ObjectId.
 * Quick-add / custom items send invalid IDs — they should not trigger
 * stock operations.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function isValidObjectId(id) {
  if (!id) return false;
  return /^[0-9a-fA-F]{24}$/.test(String(id));
}
