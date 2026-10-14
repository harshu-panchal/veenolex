/**
 * posProductService.js — POS product catalog search.
 *
 * Provides a dedicated POS product search that searches across
 * product name, SKU, barcode, itemCode, and variant-level SKU/barcode.
 * Returns variant-aware rows (one row per variant) for the POS grid.
 */

import mongoose from "mongoose";
import Product from "../../models/product.js";
import { variantsFromProductDoc } from "./variantHelpers.js";

/**
 * Products a POS may sell: the admin POS sells the admin's own (warehouse)
 * catalog, a seller POS sells that seller's products — including their
 * copies of admin catalog items. Selling anyone else's product would take
 * stock out of their inventory.
 *
 * @param {string|null} sellerId - null for the admin POS
 */
export function posOwnerFilter(sellerId = null) {
  return sellerId
    ? { sellerId: new mongoose.Types.ObjectId(String(sellerId)) }
    : { sellerId: null };
}

/** True when `product` belongs to the POS of `sellerId` (null = admin). */
export function isPOSProductOwner(product, sellerId = null) {
  const owner = product?.sellerId ? String(product.sellerId) : null;
  return sellerId ? owner === String(sellerId) : owner === null;
}

/**
 * Search and return POS-ready product rows.
 *
 * @param {Object} params
 * @param {string} params.search - Search query (name, SKU, barcode, etc.)
 * @param {number} params.limit - Max results (default 50)
 * @param {string|null} params.sellerId - Seller POS owner; null for admin POS
 * @returns {Promise<Array>} Array of variant-expanded product rows
 */
export async function getPOSProducts({ search = "", limit = 50, sellerId = null } = {}) {
  const query = { status: "active", ...posOwnerFilter(sellerId) };

  if (search && search.trim()) {
    const term = search.trim();
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");

    query.$or = [
      { name: regex },
      { sku: regex },
      { itemCode: regex },
      { barcode: term },                // Exact barcode match in array
      { "variants.sku": regex },
      { "variants.barcode": term },     // Exact variant barcode match
    ];
  }

  const products = await Product.find(query)
    .select(
      "name sku price salePrice stock mainImage barcode hsnCode gst itemCode " +
      "variants categoryId subcategoryId sellerId"
    )
    .limit(limit)
    .lean();

  // Expand each product into variant-aware rows
  const rows = [];
  for (const product of products) {
    const variants = variantsFromProductDoc(product);
    for (const variant of variants) {
      rows.push({
        productId: String(product._id),
        variantId: variant._id,
        productName: product.name,
        variantName: variant.name,
        displayName: variant.name
          ? `${product.name} — ${variant.name}`
          : product.name,
        sku: variant.sku,
        price: variant.price,
        salePrice: variant.salePrice,
        discPrice: variant.discPrice,
        purchasePrice: variant.purchasePrice,
        wholesalePrice: variant.wholesalePrice,
        compareAtPrice: variant.compareAtPrice,
        stock: variant.stock,
        barcode: variant.barcode,
        mainImage: variant.mainImage,
        hsnCode: product.hsnCode || "",
        gst: product.gst || 0,
        categoryId: product.categoryId,
        subcategoryId: product.subcategoryId,
        sellerId: product.sellerId,
        isVirtual: variant.isVirtual,
      });
    }
  }

  return rows;
}

/**
 * Find a product by exact barcode match.
 * Used for barcode scanner input to auto-add to cart.
 *
 * @param {string} barcode - Scanned barcode value
 * @param {Object} [options]
 * @param {string|null} [options.sellerId] - Seller POS owner; null for admin POS
 * @returns {Promise<Object|null>} Matching product row or null
 */
export async function findProductByBarcode(barcode, { sellerId = null } = {}) {
  if (!barcode || !barcode.trim()) return null;

  const term = barcode.trim();

  // Search root-level barcode array and variant barcode arrays
  const product = await Product.findOne({
    status: "active",
    ...posOwnerFilter(sellerId),
    $or: [
      { barcode: term },
      { "variants.barcode": term },
    ],
  }).lean();

  if (!product) return null;

  // Find which specific variant matched
  const variants = variantsFromProductDoc(product);
  for (const variant of variants) {
    if (
      Array.isArray(variant.barcode) &&
      variant.barcode.includes(term)
    ) {
      return {
        productId: String(product._id),
        variantId: variant._id,
        productName: product.name,
        variantName: variant.name,
        displayName: variant.name
          ? `${product.name} — ${variant.name}`
          : product.name,
        sku: variant.sku,
        price: variant.price,
        salePrice: variant.salePrice,
        discPrice: variant.discPrice,
        purchasePrice: variant.purchasePrice,
        wholesalePrice: variant.wholesalePrice,
        stock: variant.stock,
        barcode: variant.barcode,
        mainImage: variant.mainImage,
        hsnCode: product.hsnCode || "",
        gst: product.gst || 0,
        isVirtual: variant.isVirtual,
      };
    }
  }

  // Fallback: return first variant if barcode was at root level
  if (variants.length > 0) {
    const v = variants[0];
    return {
      productId: String(product._id),
      variantId: v._id,
      productName: product.name,
      variantName: v.name,
      displayName: v.name ? `${product.name} — ${v.name}` : product.name,
      sku: v.sku,
      price: v.price,
      salePrice: v.salePrice,
      discPrice: v.discPrice,
      purchasePrice: v.purchasePrice,
      wholesalePrice: v.wholesalePrice,
      stock: v.stock,
      barcode: v.barcode,
      mainImage: v.mainImage,
      hsnCode: product.hsnCode || "",
      gst: product.gst || 0,
      isVirtual: v.isVirtual,
    };
  }

  return null;
}
