/**
 * gstUtils.js — GST calculation helpers for POS.
 *
 * POS treats line prices as **GST-inclusive** (B2C standard in India).
 * The GST amount is back-calculated from the inclusive price.
 */

/**
 * Calculate GST from an inclusive price.
 *
 * Formula: gstAmount = total × gstPercent / (100 + gstPercent)
 *
 * @param {number} unitPrice - Per-unit selling price (GST inclusive)
 * @param {number} quantity
 * @param {number} gstPercent - GST rate (e.g. 5, 12, 18, 28)
 * @returns {{ total: number, gstAmount: number, taxableAmount: number }}
 */
export function calculateInclusiveGST(unitPrice, quantity, gstPercent) {
  const total = (unitPrice || 0) * (quantity || 0);
  const gst = Number(gstPercent) || 0;

  if (gst <= 0) {
    return { total, gstAmount: 0, taxableAmount: total };
  }

  const gstAmount = roundTo2(total * gst / (100 + gst));
  const taxableAmount = roundTo2(total - gstAmount);

  return { total, gstAmount, taxableAmount };
}

/**
 * Calculate GST split (CGST + SGST for intra-state, IGST for inter-state).
 * For POS, almost always intra-state (same state), so CGST = SGST = GST/2.
 *
 * @param {number} gstAmount - Total GST amount
 * @param {boolean} isInterState - Whether this is an inter-state transaction
 * @returns {{ cgst: number, sgst: number, igst: number }}
 */
export function splitGST(gstAmount, isInterState = false) {
  if (isInterState) {
    return { cgst: 0, sgst: 0, igst: roundTo2(gstAmount) };
  }
  const half = roundTo2(gstAmount / 2);
  return { cgst: half, sgst: half, igst: 0 };
}

/**
 * Resolve GST percentage for a product/variant.
 * Priority: variant-level gst → product-level gst → 0
 *
 * @param {Object} product - Product document
 * @param {Object|null} variant - Variant subdocument
 * @returns {number} GST percentage
 */
export function resolveGSTPercent(product, variant) {
  // Variants don't have their own GST in the current schema,
  // so always use product-level GST.
  return Number(product?.gst) || 0;
}

/**
 * Resolve HSN code for a product/variant.
 *
 * @param {Object} product
 * @param {Object|null} variant
 * @returns {string}
 */
export function resolveHSNCode(product, variant) {
  return product?.hsnCode || "";
}

/**
 * Round to 2 decimal places.
 * @param {number} n
 * @returns {number}
 */
function roundTo2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
