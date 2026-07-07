import mongoose from "mongoose";

/**
 * SellerPurchaseEntry — purchase/quotation draft storage for Seller POS.
 */
const sellerPurchaseEntrySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["purchase", "quotation"],
      required: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
    },
  },
  { timestamps: true }
);

sellerPurchaseEntrySchema.index({ seller: 1, type: 1, createdAt: -1 });

export default mongoose.model("SellerPurchaseEntry", sellerPurchaseEntrySchema);
