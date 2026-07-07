import mongoose from "mongoose";

/**
 * POSStockLedger — POS-specific inventory audit trail.
 *
 * Every POS stock movement (sale, edit-restore, edit-deduct, purchase,
 * manual adjustment) creates a ledger row. This is separate from the
 * existing `StockHistory` model which tracks online order stock changes.
 */
const posStockLedgerSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variant: String,           // Variant name/label for display
    variantId: String,         // Variant _id as string
    productName: String,
    sku: String,
    type: {
      type: String,
      enum: ["IN", "OUT"],
      required: true,
    },
    source: {
      type: String,
      enum: [
        "POS",                  // Normal POS sale
        "ORDER_EDIT_RESTORE",   // Stock restored during order edit
        "ORDER_EDIT_DEDUCT",    // Stock deducted during order edit
        "PURCHASE",             // Purchase entry stock-in
        "ADJUSTMENT",           // Manual correction
      ],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
    },
    note: String,
  },
  { timestamps: true }
);

posStockLedgerSchema.index({ product: 1, createdAt: -1 });
posStockLedgerSchema.index({ order: 1 });
posStockLedgerSchema.index({ seller: 1, createdAt: -1 });
posStockLedgerSchema.index({ source: 1, type: 1 });

export default mongoose.model("POSStockLedger", posStockLedgerSchema);
