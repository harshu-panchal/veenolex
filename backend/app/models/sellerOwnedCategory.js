import mongoose from "mongoose";

/**
 * SellerOwnedCategory — POS-only categories created by sellers.
 *
 * These are separate from the main Category hierarchy and only visible
 * in the seller's POS interface. Requires `seller.canCreateCategories = true`.
 */
const sellerOwnedCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
    },
  },
  { timestamps: true }
);

sellerOwnedCategorySchema.index({ seller: 1, name: 1 }, { unique: true });

export default mongoose.model("SellerOwnedCategory", sellerOwnedCategorySchema);
