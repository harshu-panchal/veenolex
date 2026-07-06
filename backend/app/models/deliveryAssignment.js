import mongoose from "mongoose";

const deliveryAssignmentSchema = new mongoose.Schema(
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
    orderMongoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      index: true,
    },
    orderId: {
      type: String,
      index: true,
    },
    status: {
      type: String,
      enum: ["broadcasting", "assigned", "superseded", "timeout", "cancelled"],
      default: "broadcasting",
    },
    winnerDeliveryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Delivery",
    },
    radiusMeters: {
      type: Number,
      default: 5000,
    },
    attempt: {
      type: Number,
      default: 1,
    },
    expiresAt: Date,
    candidateIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Delivery",
      },
    ],
    meta: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true },
);

deliveryAssignmentSchema.index({ orderId: 1, createdAt: -1 });

export default mongoose.model("DeliveryAssignment", deliveryAssignmentSchema);
