import mongoose from "mongoose";

const deliveryShipmentSchema = new mongoose.Schema(
  {
    orderId: {
      type: String, // Matches internal orderId or requestNumber
      required: true,
      index: true,
    },
    shipRocketOrderId: {
      type: String,
      required: true,
      index: true,
    },
    awbCode: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      default: "NEW",
    },
    timeline: [
      {
        status: { type: String, required: true },
        activity: { type: String, default: "" },
        location: { type: String, default: "" },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

deliveryShipmentSchema.index({ shipRocketOrderId: 1 });

export default mongoose.model("DeliveryShipment", deliveryShipmentSchema);
