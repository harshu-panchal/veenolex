import mongoose from "mongoose";

/**
 * AdminPurchaseEntry — purchase/quotation draft storage for Admin POS.
 *
 * The `data` field stores the full UI draft JSON as Mixed type,
 * allowing the frontend to persist/restore complex purchase forms.
 */
const adminPurchaseEntrySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["purchase", "quotation"],
      required: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true }
);

adminPurchaseEntrySchema.index({ type: 1, createdAt: -1 });
adminPurchaseEntrySchema.index({ createdBy: 1 });

export default mongoose.model("AdminPurchaseEntry", adminPurchaseEntrySchema);
