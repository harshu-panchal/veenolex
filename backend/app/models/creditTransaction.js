import mongoose from "mongoose";

/**
 * CreditTransaction — POS udhaar (credit) ledger.
 *
 * Records every credit-related event: orders placed on credit,
 * cash/online payments against credit balance, adjustments, and refunds.
 */
const creditTransactionSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["Order", "Payment", "Adjustment", "Refund"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Online", null],
      default: null,
    },
    transactionId: String,  // PhonePe transaction ID for online payments
    note: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
    },
    createdByRole: {
      type: String,
      enum: ["Admin", "Seller"],
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
    },
  },
  { timestamps: true }
);

creditTransactionSchema.index({ customer: 1, createdAt: -1 });
creditTransactionSchema.index({ order: 1 });
creditTransactionSchema.index({ seller: 1, customer: 1 });
creditTransactionSchema.index({ type: 1, createdAt: -1 });

export default mongoose.model("CreditTransaction", creditTransactionSchema);
