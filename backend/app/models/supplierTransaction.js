import mongoose from "mongoose";

/**
 * SupplierTransaction — individual debt/payment events for a supplier.
 */
const supplierTransactionSchema = new mongoose.Schema(
  {
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupplierLedger",
      required: true,
    },
    type: {
      type: String,
      enum: ["Debt", "Payment"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    balanceAfter: Number,
    paymentMethod: String,
    note: String,
    invoiceNumber: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  { timestamps: true }
);

supplierTransactionSchema.index({ supplier: 1, createdAt: -1 });
supplierTransactionSchema.index({ type: 1 });

export default mongoose.model("SupplierTransaction", supplierTransactionSchema);
