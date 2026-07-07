import mongoose from "mongoose";

/**
 * SellerPOSState — server-side persistence for seller multi-bill UI state.
 *
 * Sellers' POS bill state is synced to the server (debounced ~300ms)
 * so that bills persist across browser refreshes and device switches.
 * One document per seller, upserted on every state change.
 */
const sellerPOSStateSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      unique: true,
    },
    bills: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    activeBillIndex: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("SellerPOSState", sellerPOSStateSchema);
