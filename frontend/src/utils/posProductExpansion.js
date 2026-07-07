/**
 * posProductExpansion.js — Expands products with multiple variants.
 *
 * Each variant is returned as an independent card for the POS terminal.
 * If a product has no variants, a virtual single variant is returned representing the product.
 *
 * @param {Array} products - Raw product list from API
 * @returns {Array} Expanded list of POS-ready product cards
 */
export function expandPOSProducts(products) {
  if (!Array.isArray(products)) return [];

  const expanded = [];

  for (const product of products) {
    const variants = product.variants || [];

    if (variants.length === 0) {
      // Root-only product
      expanded.push({
        productId: product._id,
        variantId: null,
        productName: product.name,
        variantName: "",
        displayName: product.name,
        sku: product.sku || "",
        price: product.price || 0,
        salePrice: product.salePrice || 0,
        discPrice: product.salePrice || 0,
        purchasePrice: product.purchasePrice || 0,
        wholesalePrice: product.wholesalePrice || 0,
        compareAtPrice: product.price || 0,
        stock: product.stock || 0,
        barcode: product.barcode || [],
        mainImage: product.mainImage || product.image || "",
        hsnCode: product.hsnCode || "",
        gst: product.gst || 0,
        isVirtual: true,
      });
    } else {
      // Multiple variants
      for (const variant of variants) {
        expanded.push({
          productId: product._id,
          variantId: variant._id,
          productName: product.name,
          variantName: variant.name || "",
          displayName: variant.name
            ? `${product.name} — ${variant.name}`
            : product.name,
          sku: variant.sku || product.sku || "",
          price: variant.price ?? product.price ?? 0,
          salePrice: variant.salePrice ?? product.salePrice ?? 0,
          discPrice: variant.discPrice ?? variant.salePrice ?? product.salePrice ?? 0,
          purchasePrice: variant.purchasePrice || 0,
          wholesalePrice: variant.wholesalePrice || 0,
          compareAtPrice: variant.compareAtPrice ?? variant.price ?? product.price ?? 0,
          stock: variant.stock ?? 0,
          barcode: variant.barcode || product.barcode || [],
          mainImage: variant.mainImage || product.mainImage || product.image || "",
          hsnCode: product.hsnCode || "",
          gst: product.gst || 0,
          isVirtual: false,
        });
      }
    }
  }

  return expanded;
}
export default expandPOSProducts;
