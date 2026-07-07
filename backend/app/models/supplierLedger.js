import mongoose from "mongoose";

/**
 * SupplierLedger — POS supplier accounts.
 *
 * Tracks supplier contact info and running balance (debt owed to suppliers).
 * Each supplier can be scoped to admin (seller: null) or a specific seller.
 */
const supplierLedgerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    gstin: {
      type: String,
      trim: true,
    },
    totalDebt: {
      type: Number,
      default: 0,
    },
    totalPaid: {
      type: Number,
      default: 0,
    },
    balance: {
      type: Number,
      default: 0,  // Positive = owes supplier, Negative = advance
    },
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
      default: null,  // null = admin supplier
    },
  },
  { timestamps: true }
);

supplierLedgerSchema.index({ seller: 1, name: 1 });
supplierLedgerSchema.index({ createdByRole: 1 });

export default mongoose.model("SupplierLedger", supplierLedgerSchema);
