/**
 * gstUtils.js — GST inclusive calculations for POS frontend.
 */

/**
 * Calculates GST amount and taxable amount from an inclusive unit price.
 *
 * @param {number} unitPrice - Per-unit item price (inclusive of GST)
 * @param {number} quantity
 * @param {number} gstPercent - GST percentage (e.g. 18)
 * @returns {{ total: number, gstAmount: number, taxableAmount: number }}
 */
export function calculateInclusiveGST(unitPrice, quantity = 1, gstPercent = 0) {
  const total = (Number(unitPrice) || 0) * (Number(quantity) || 0);
  const gst = Number(gstPercent) || 0;

  if (gst <= 0) {
    return {
      total,
      gstAmount: 0,
      taxableAmount: total
    };
  }

  // Formula: gstAmount = total * gstPercent / (100 + gstPercent)
  const gstAmount = roundTo2(total * gst / (100 + gst));
  const taxableAmount = roundTo2(total - gstAmount);

  return {
    total,
    gstAmount,
    taxableAmount
  };
}

/**
 * Split GST amount into CGST and SGST (half each) or IGST.
 *
 * @param {number} gstAmount
 * @param {boolean} isInterState
 * @returns {{ cgst: number, sgst: number, igst: number }}
 */
export function splitGST(gstAmount, isInterState = false) {
  const amt = Number(gstAmount) || 0;
  if (isInterState) {
    return { cgst: 0, sgst: 0, igst: roundTo2(amt) };
  }
  const half = roundTo2(amt / 2);
  return { cgst: half, sgst: half, igst: 0 };
}

function roundTo2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
