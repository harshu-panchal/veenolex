import logger from "../services/logger.js";
import Payment from "../models/payment.js";
import { reconcilePaymentStatus } from "../services/paymentService.js";

export function getPaymentReconciliationJobHandler() {
  return async () => {
    logger.info("🔄 Starting payment reconciliation job");
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    
    try {
      const pendingPayments = await Payment.find({
        gatewayName: "RAZORPAY",
        status: { $in: ["CREATED", "PENDING"] },
        createdAt: { $lt: threeMinutesAgo },
        reconciliationAttempts: { $lt: 20 }
      });

      if (pendingPayments.length === 0) {
        logger.debug("ℹ️ No pending payments found for reconciliation");
        return;
      }

      logger.info(`🔍 Found ${pendingPayments.length} pending Razorpay payments for reconciliation`);

      for (const payment of pendingPayments) {
        try {
          payment.reconciliationAttempts += 1;
          payment.lastReconciledAt = new Date();
          await payment.save();

          await reconcilePaymentStatus(payment);
        } catch (err) {
          logger.error(`❌ Error reconciling payment ${payment._id}:`, { error: err.message });
        }
      }
    } catch (error) {
      logger.error("❌ Payment reconciliation job failed:", { error: error.message });
    }
  };
}

export function getPaymentReconciliationJobInterval() {
  return parseInt(process.env.RECONCILIATION_INTERVAL_MS || "180000", 10); // Default: 3 minutes
}

export function isPaymentReconciliationJobEnabled() {
  return true;
}
