import mongoose from "mongoose";

const deliveryWebhookEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    providerName: {
      type: String,
      required: true,
      default: "SHIPROCKET",
    },
    payloadHash: {
      type: String,
      required: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

deliveryWebhookEventSchema.index({ eventId: 1, processedAt: -1 });

export default mongoose.model("DeliveryWebhookEvent", deliveryWebhookEventSchema);
