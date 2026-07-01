import mongoose from "mongoose";

const offlineSaleSchema = new mongoose.Schema(
  {
    // ═══════════════════════════════════════════════════════
    // SELLER INFORMATION
    // ═══════════════════════════════════════════════════════
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      index: true  // Fast lookup by seller
    },

    sellerName: {
      type: String,
      required: true
    },

    // ═══════════════════════════════════════════════════════
    // CUSTOMER INFORMATION (for offline identification)
    // ═══════════════════════════════════════════════════════
    customerName: {
      type: String,
      required: true,
      trim: true
    },

    customerPhone: {
      type: String,
      required: true,
      trim: true
      // Phone number to identify customer
    },

    // ═══════════════════════════════════════════════════════
    // ITEMS BOUGHT
    // ═══════════════════════════════════════════════════════
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true
        },
        productName: {
          type: String,
          required: true
        },
        quantity: {
          type: Number,
          required: true,
          min: 1
        },
        pricePerUnit: {
          type: Number,
          required: true,
          min: 0
        },
        subTotal: {
          type: Number,
          required: true,
          min: 0
        }
      }
    ],

    totalAmount: {
      type: Number,
      required: true,
      min: 0
      // Sum of all subTotals
    },

    paymentMethod: {
      type: String,
      enum: ["CASH", "CARD", "UPI", "BANK_TRANSFER", "OTHER"],
      default: "CASH"
    },

    // ═══════════════════════════════════════════════════════
    // TIMESTAMPS
    // ═══════════════════════════════════════════════════════
    createdAt: {
      type: Date,
      default: Date.now,
      index: true  // Fast sorting by date
    },

    updatedAt: {
      type: Date,
      default: Date.now
    },

    // ═══════════════════════════════════════════════════════
    // METADATA (Optional - for future use)
    // ═══════════════════════════════════════════════════════
    notes: {
      type: String,
      default: ""
      // Seller can add notes (e.g., "Bulk order", "Friend referral")
    },

    status: {
      type: String,
      enum: ["COMPLETED", "PENDING", "CANCELLED"],
      default: "COMPLETED"
    }
  },
  { timestamps: true }
);

// Create indexes for fast queries
offlineSaleSchema.index({ sellerId: 1, createdAt: -1 });
offlineSaleSchema.index({ productId: 1 });
offlineSaleSchema.index({ customerPhone: 1 });

const OfflineSale = mongoose.model("OfflineSale", offlineSaleSchema);

export default OfflineSale;
