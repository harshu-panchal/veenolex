/**
 * posCartLineId.js — Helper to generate a unique cart line ID for POS items.
 *
 * Combines productId and optional variantId so that the cart aggregates
 * identical variants together while keeping different variants of the same
 * product separate.
 *
 * @param {string} productId
 * @param {string|null} variantId
 * @returns {string} Unique string identifier for the cart line
 */
export function getCartLineId(productId, variantId) {
  if (!productId) return "";
  return variantId ? `${productId}-${variantId}` : productId;
}
export default getCartLineId;
