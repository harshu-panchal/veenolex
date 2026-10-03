import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Wallet from "../app/models/wallet.js";
import LedgerEntry from "../app/models/ledgerEntry.js";
import Payout from "../app/models/payout.js";
import Transaction from "../app/models/transaction.js";
import CreditTransaction from "../app/models/creditTransaction.js";
import FinanceAuditLog from "../app/models/financeAuditLog.js";
import FinanceReport from "../app/models/financeReports.js";
import Order from "../app/models/order.js";
import CheckoutGroup from "../app/models/checkoutGroup.js";
import Payment from "../app/models/payment.js";
import PaymentWebhookEvent from "../app/models/paymentWebhookEvent.js";
import Delivery from "../app/models/delivery.js";
import DeliveryAssignment from "../app/models/deliveryAssignment.js";
import DeliveryShipment from "../app/models/deliveryShipment.js";
import DeliveryWebhookEvent from "../app/models/deliveryWebhookEvent.js";
import OrderOtp from "../app/models/orderOtp.js";
import GstReportEntry from "../app/models/gstReportEntry.js";
import Customer from "../app/models/customer.js";
import { OWNER_TYPE } from "../app/constants/finance.js";

async function resetAllWalletAndOrderData() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  console.log("--- Starting Deletion & Reset ---");

  const [
    delLedger,
    delPayout,
    delTxn,
    delCreditTxn,
    delAudit,
    delFinanceReports,
    delOrders,
    delCheckoutGroups,
    delPayments,
    delPaymentWebhooks,
    delDelivery,
    delAssignments,
    delShipments,
    delDeliveryWebhooks,
    delOrderOtps,
    delGstReports,
  ] = await Promise.all([
    LedgerEntry.deleteMany({}),
    Payout.deleteMany({}),
    Transaction.deleteMany({}),
    CreditTransaction.deleteMany({}),
    FinanceAuditLog.deleteMany({}),
    FinanceReport.deleteMany({}),
    Order.deleteMany({}),
    CheckoutGroup.deleteMany({}),
    Payment.deleteMany({}),
    PaymentWebhookEvent.deleteMany({}),
    Delivery.deleteMany({}),
    DeliveryAssignment.deleteMany({}),
    DeliveryShipment.deleteMany({}),
    DeliveryWebhookEvent.deleteMany({}),
    OrderOtp.deleteMany({}),
    GstReportEntry.deleteMany({}),
  ]);

  // Reset or recreate canonical Admin Wallet with 0 balances
  await Wallet.deleteMany({});
  await Wallet.create({
    ownerType: OWNER_TYPE.ADMIN,
    ownerId: null,
    currency: "INR",
    availableBalance: 0,
    pendingBalance: 0,
    cashInHand: 0,
    totalCredited: 0,
    totalDebited: 0,
    status: "ACTIVE",
  });

  // Reset all customer wallet balances to 0
  const updatedCustomers = await Customer.updateMany({}, { $set: { walletBalance: 0 } });

  console.log("Deletion summary:");
  console.log({
    ledgersDeleted: delLedger.deletedCount,
    payoutsDeleted: delPayout.deletedCount,
    transactionsDeleted: delTxn.deletedCount,
    creditTransactionsDeleted: delCreditTxn.deletedCount,
    auditLogsDeleted: delAudit.deletedCount,
    financeReportsDeleted: delFinanceReports.deletedCount,
    ordersDeleted: delOrders.deletedCount,
    checkoutGroupsDeleted: delCheckoutGroups.deletedCount,
    paymentsDeleted: delPayments.deletedCount,
    paymentWebhooksDeleted: delPaymentWebhooks.deletedCount,
    deliveryAssignmentsDeleted: delAssignments.deletedCount,
    deliveryShipmentsDeleted: delShipments.deletedCount,
    deliveryWebhooksDeleted: delDeliveryWebhooks.deletedCount,
    orderOtpsDeleted: delOrderOtps.deletedCount,
    gstReportsDeleted: delGstReports.deletedCount,
    customersWalletReset: updatedCustomers.modifiedCount,
  });

  console.log("--- Reset Complete ---");
  await mongoose.disconnect();
}

resetAllWalletAndOrderData().catch((err) => {
  console.error("Error resetting data:", err);
  process.exit(1);
});
