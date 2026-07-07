import mongoose from "mongoose";

/**
 * SellerOwnedSubCategory — POS-only subcategories under seller-owned categories.
 */
const sellerOwnedSubCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SellerOwnedCategory",
      required: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
    },
  },
  { timestamps: true }
);

sellerOwnedSubCategorySchema.index({ category: 1, seller: 1 });
sellerOwnedSubCategorySchema.index({ seller: 1, name: 1 });

export default mongoose.model("SellerOwnedSubCategory", sellerOwnedSubCategorySchema);
