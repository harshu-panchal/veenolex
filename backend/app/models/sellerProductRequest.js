import mongoose from "mongoose";

// Individual product item in request
const requestItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  productImage: {
    type: String,
    default: ""
  },
  category: {
    type: String,
    default: ""
  },
  pricePerUnit: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
    // Calculated: pricePerUnit × quantity
  }
});

// Main request schema
const sellerProductRequestSchema = new mongoose.Schema(
  {
    // ─────────────────────────────────
    // REQUEST IDENTIFICATION
    // ─────────────────────────────────
    requestNumber: {
      type: String,
      unique: true
      // Auto-generated: REQ-2026-001
    },

    // ─────────────────────────────────
    // SELLER INFO
    // ─────────────────────────────────
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      index: true
    },
    sellerName: {
      type: String,
      required: true
    },
    sellerEmail: {
      type: String,
      default: ""
    },
    sellerPhone: {
      type: String,
      default: ""
    },

    // ─────────────────────────────────
    // PRODUCTS REQUESTED
    // ─────────────────────────────────
    items: {
      type: [requestItemSchema],
      required: true,
      validate: {
        validator: (items) => items.length > 0,
        message: "At least one product required"
      }
    },

    // ─────────────────────────────────
    // BILLING
    // ─────────────────────────────────
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    tax: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },

    // ─────────────────────────────────
    // PAYMENT
    // ─────────────────────────────────
    paymentType: {
      type: String,
      enum: ["PAY_NOW", "PAY_AFTER_DELIVERY"],
      required: true
    },
    paymentStatus: {
      type: String,
      enum: ["PAID", "PENDING", "FAILED", "REFUNDED"],
      default: "PENDING"
    },
    paidAt: {
      type: Date,
      default: null
    },
    transactionId: {
      type: String,
      default: null
    },

    // ─────────────────────────────────
    // REQUEST STATUS
    // ─────────────────────────────────
    status: {
      type: String,
      enum: [
        "PENDING",    // Just submitted
        "APPROVED",   // Admin approved
        "REJECTED",   // Admin rejected
        "DISPATCHED", // Products sent
        "DELIVERED",  // Products received
        "CANCELLED"   // Cancelled by seller
      ],
      default: "PENDING",
      index: true
    },

    // ─────────────────────────────────
    // ADMIN ACTIONS
    // ─────────────────────────────────
    adminNote: {
      type: String,
      default: ""
      // Admin can add notes when approving/rejecting
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    },
    rejectedReason: {
      type: String,
      default: ""
    },

    // ─────────────────────────────────
    // BILL / INVOICE
    // ─────────────────────────────────
    invoiceNumber: {
      type: String,
      unique: true,
      sparse: true
      // Format: INV-2026-001
    },
    invoiceGeneratedAt: {
      type: Date,
      default: null
    },

    // ─────────────────────────────────
    // DELIVERY TRACKING
    // ─────────────────────────────────
    deliveryBoy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Delivery",
      default: null
    },
    deliveryWorkflowStatus: {
      type: String,
      enum: ["DELIVERY_SEARCH", "DELIVERY_ASSIGNED", "PICKUP_READY", "OUT_FOR_DELIVERY", "DELIVERED"],
      default: null
    },
    // Riders who declined this request. Without this path declared, the push in
    // skipOrder() was dropped on save (strict mode), so a skipped request kept
    // reappearing in the rider's available list on every poll.
    skippedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Delivery"
      }
    ],
    // End of the rider broadcast window. startRequestDeliverySearch() has always
    // assigned this, but without the path declared it was dropped on save, so a
    // request left in DELIVERY_SEARCH stayed in the rider pool forever.
    deliverySearchExpiresAt: {
      type: Date,
      default: null
    },
    otpValidationLocation: {
      lat: Number,
      lng: Number
    },
    deliveredAt: {
      type: Date,
      default: null
    },
    deliveryType: {
      type: String,
      enum: ["SELLER_DIRECT", "SHIPROCKET", "STANDARD", "LOCAL"],
      default: "SELLER_DIRECT"
    },
    shipRocketDetails: {
      orderId: String,
      trackingNumber: String,
      status: String,
      estimatedDelivery: Date
    },

    // ─────────────────────────────────
    // NOTES
    // ─────────────────────────────────
    sellerNote: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

// ─────────────────────────────────
// AUTO GENERATE REQUEST NUMBER
// ─────────────────────────────────
sellerProductRequestSchema.pre("save", async function (next) {
  if (!this.requestNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model(
      "SellerProductRequest"
    ).countDocuments();
    this.requestNumber = `REQ-${year}-${String(count + 1).padStart(4, "0")}`;
  }
  if (!this.invoiceNumber && this.status !== "PENDING") {
    this.invoiceNumber = this.requestNumber.replace("REQ", "INV");
  }
  next();
});

// Indexes for fast queries
sellerProductRequestSchema.index({ sellerId: 1, createdAt: -1 });
sellerProductRequestSchema.index({ status: 1, createdAt: -1 });
sellerProductRequestSchema.index({ requestNumber: 1 });

const SellerProductRequest = mongoose.model(
  "SellerProductRequest",
  sellerProductRequestSchema
);

export default SellerProductRequest;
