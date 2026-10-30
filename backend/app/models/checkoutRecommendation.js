import mongoose from "mongoose";

const checkoutRecommendationSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    order: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

checkoutRecommendationSchema.index({ status: 1, order: 1, createdAt: 1 });

export default mongoose.model("CheckoutRecommendation", checkoutRecommendationSchema);

