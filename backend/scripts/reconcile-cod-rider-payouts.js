/**
 * Find and reverse rider payouts that duplicate COD cash.
 *
 * On a COD order the rider is paid out of the cash they collect:
 * `handleCodOrderFinance` only adds (collected − riderPayoutTotal) to their
 * `cashInHand`, so the commission and tip stay in their pocket and the rest
 * is remitted. Until this was fixed, `settleDeliveredOrder` *also* queued a
 * `DELIVERY_PARTNER` payout for the same `riderPayoutTotal` — paying every
 * COD rider twice.
 *
 * This script reports every COD order carrying such a payout and, with
 * `--apply`, cancels the ones that have not been paid out yet
 * (PENDING / PROCESSING) through the normal cancellation path, which also
 * releases the rider's `pendingBalance`.
 *
 * COMPLETED payouts are reported but never touched: that money has already
 * left the platform, so recovering it is a decision for finance (deduct from
 * a future payout, or write it off), not for a script.
 *
 * Usage:
 *   node scripts/reconcile-cod-rider-payouts.js            # report only
 *   node scripts/reconcile-cod-rider-payouts.js --apply    # cancel pending
 */

import dotenv from "dotenv";
import connectDB from "../app/dbConfig/dbConfig.js";
import Order from "../app/models/order.js";
import Payout from "../app/models/payout.js";
import { cancelPendingPayoutForOrder } from "../app/services/finance/payoutService.js";
import { PAYOUT_STATUS, PAYOUT_TYPE } from "../app/constants/finance.js";
import { roundCurrency } from "../app/utils/money.js";

dotenv.config();

const APPLY = process.argv.includes("--apply");
const LABEL = "[reconcile-cod-rider-payouts]";

async function run() {
  await connectDB();

  const payouts = await Payout.find({
    payoutType: PAYOUT_TYPE.DELIVERY_PARTNER,
    status: { $ne: PAYOUT_STATUS.CANCELLED },
  })
    .select("relatedOrderIds beneficiaryId amount status")
    .lean();

  let scanned = 0;
  let duplicates = 0;
  let cancelled = 0;
  let alreadyPaid = 0;
  let pendingAmount = 0;
  let paidAmount = 0;
  const failures = [];

  for (const payout of payouts) {
    const orderIds = Array.isArray(payout.relatedOrderIds) ? payout.relatedOrderIds : [];
    if (orderIds.length === 0) continue;

    const codOrders = await Order.find({
      _id: { $in: orderIds },
      paymentMode: "COD",
      "financeFlags.codMarkedCollected": true,
    })
      .select("orderId paymentBreakdown.riderPayoutTotal")
      .lean();

    scanned += 1;
    if (codOrders.length === 0) continue;

    duplicates += 1;
    const amount = roundCurrency(payout.amount);
    const orderLabel = codOrders.map((order) => order.orderId).join(",");

    if (payout.status === PAYOUT_STATUS.COMPLETED) {
      alreadyPaid += 1;
      paidAmount = roundCurrency(paidAmount + amount);
      console.log(
        `${LABEL} ALREADY PAID payout=${payout._id} rider=${payout.beneficiaryId} amount=${amount} orders=${orderLabel} — needs a manual finance decision`,
      );
      continue;
    }

    pendingAmount = roundCurrency(pendingAmount + amount);
    console.log(
      `${LABEL} DUPLICATE payout=${payout._id} status=${payout.status} rider=${payout.beneficiaryId} amount=${amount} orders=${orderLabel}`,
    );

    if (!APPLY) continue;

    try {
      const result = await cancelPendingPayoutForOrder(
        orderIds[0],
        PAYOUT_TYPE.DELIVERY_PARTNER,
        { remarks: "Duplicate of COD cash already kept by the rider" },
      );
      if (result) cancelled += 1;
    } catch (error) {
      failures.push({ payoutId: String(payout._id), message: error.message });
      console.error(`${LABEL} FAILED payout=${payout._id}: ${error.message}`);
    }
  }

  console.log(
    `${LABEL} ${APPLY ? "APPLIED" : "REPORT ONLY"} scannedPayouts=${scanned} duplicates=${duplicates} cancelled=${cancelled} pendingAmount=${pendingAmount} alreadyPaid=${alreadyPaid} paidAmount=${paidAmount} failures=${failures.length}`,
  );
  if (!APPLY && duplicates > 0) {
    console.log(`${LABEL} re-run with --apply to cancel the unpaid duplicates`);
  }

  process.exit(failures.length > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(`${LABEL} failed:`, error);
  process.exit(1);
});
