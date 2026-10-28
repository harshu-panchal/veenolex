/**
 * Refund customers who were charged twice for their wallet redemption.
 *
 * Until the pricing pipeline was fixed, `paymentBreakdown.grandTotal` did not
 * subtract the wallet redemption, while the wallet was still debited at
 * placement. The gateway therefore charged (and COD riders collected) the
 * full total *on top of* the wallet debit, so every wallet-using customer
 * overpaid by exactly their redemption.
 *
 * An affected order looks like:
 *   - `pricing.walletAmount > 0`                 (wallet was redeemed), AND
 *   - `paymentBreakdown.walletAmount` is 0/absent (grandTotal never netted
 *     it off — this is what distinguishes an old order from a new one), AND
 *   - the money was actually taken: online payment captured, or COD cash
 *     collected.
 *
 * Cancelled orders are skipped: `reverseOrderFinanceOnCancellation` already
 * credits `pricing.walletAmount` back.
 *
 * Usage:
 *   node scripts/backfill-wallet-overcharge.js            # report only
 *   node scripts/backfill-wallet-overcharge.js --apply    # credit wallets
 *
 * Credits are idempotent through the ledger key `WLT-OVERCHARGE-<orderId>`,
 * so a re-run after a partial failure never double-credits.
 */

import dotenv from "dotenv";
import connectDB from "../app/dbConfig/dbConfig.js";
import Order from "../app/models/order.js";
import { creditWallet } from "../app/services/finance/walletService.js";
import { LEDGER_TRANSACTION_TYPE, OWNER_TYPE } from "../app/constants/finance.js";
import { roundCurrency } from "../app/utils/money.js";

dotenv.config();

const APPLY = process.argv.includes("--apply");
const LABEL = "[backfill-wallet-overcharge]";

function overchargeFor(order) {
  const redeemed = roundCurrency(order?.pricing?.walletAmount || 0);
  if (redeemed <= 0) return 0;

  // A post-fix order has the redemption recorded on the breakdown, which
  // means `grandTotal` is already net of it: nothing was overcharged.
  const nettedOff = roundCurrency(order?.paymentBreakdown?.walletAmount || 0);
  if (nettedOff > 0) return 0;

  const captured = !!order?.financeFlags?.onlinePaymentCaptured;
  const cashCollected = !!order?.financeFlags?.codMarkedCollected;
  if (!captured && !cashCollected) return 0;

  return redeemed;
}

async function run() {
  await connectDB();

  const cursor = Order.find({
    "pricing.walletAmount": { $gt: 0 },
    status: { $nin: ["cancelled", "Cancelled", "CANCELLED"] },
  })
    .select(
      "orderId customer pricing paymentBreakdown financeFlags paymentMode status",
    )
    .cursor();

  let scanned = 0;
  let affected = 0;
  let credited = 0;
  let totalAmount = 0;
  const failures = [];

  for await (const order of cursor) {
    scanned += 1;
    const amount = overchargeFor(order);
    if (amount <= 0) continue;

    affected += 1;
    totalAmount = roundCurrency(totalAmount + amount);

    console.log(
      `${LABEL} order=${order.orderId} customer=${order.customer} mode=${order.paymentMode} overcharged=${amount}`,
    );

    if (!APPLY) continue;

    try {
      await creditWallet({
        ownerType: OWNER_TYPE.CUSTOMER,
        ownerId: order.customer,
        amount,
        bucket: "available",
        orderId: order._id,
        ledgerType: LEDGER_TRANSACTION_TYPE.WALLET_REFUND,
        ledgerReference: `WLT-OVERCHARGE-${order.orderId}`,
        ledgerDescription:
          "Refund of wallet redemption charged twice before the pricing fix",
        idempotencyKey: `WLT-OVERCHARGE-${order._id}`,
        metadata: { source: "backfill_wallet_overcharge" },
      });
      credited += 1;
    } catch (error) {
      failures.push({ orderId: order.orderId, message: error.message });
      console.error(`${LABEL} FAILED order=${order.orderId}: ${error.message}`);
    }
  }

  console.log(
    `${LABEL} ${APPLY ? "APPLIED" : "REPORT ONLY"} scanned=${scanned} affected=${affected} credited=${credited} totalAmount=${totalAmount} failures=${failures.length}`,
  );
  if (!APPLY && affected > 0) {
    console.log(`${LABEL} re-run with --apply to credit these customers`);
  }

  process.exit(failures.length > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(`${LABEL} failed:`, error);
  process.exit(1);
});
