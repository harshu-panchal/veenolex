import mongoose from "mongoose";
import crypto from "crypto";

const orderOtpSchema = new mongoose.Schema(
  {
    sourceType: {
      type: String,
      enum: ["ORDER", "SELLER_REQUEST"],
      required: true,
      default: "ORDER",
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "sourceType",
      index: true,
    },
    // Legacy fields for backward compatibility
    orderId: {
      type: String,
      index: true,
    },
    orderMongoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    type: {
      type: String,
      enum: ["delivery", "return_pickup", "return_drop"],
      default: "delivery",
      index: true,
    },
    codeHash: {
      type: String,
      required: true,
    },
    code: {
      type: String,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    lastGeneratedAt: {
      type: Date,
    },
    consumedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

orderOtpSchema.index({ orderId: 1, consumedAt: 1 });

orderOtpSchema.statics.hashCode = function (plain) {
  return crypto.createHash("sha256").update(String(plain)).digest("hex");
};

export default mongoose.model("OrderOtp", orderOtpSchema);
