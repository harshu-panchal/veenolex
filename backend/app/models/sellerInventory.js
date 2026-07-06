import mongoose from "mongoose";

const sellerInventorySchema = new mongoose.Schema(
  {
    // ─────────────────────────────────────
    // SELLER INFO
    // ─────────────────────────────────────
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

    // ─────────────────────────────────────
    // LINKED TO ADMIN PRODUCT (READ ONLY)
    // Seller cannot change these fields
    // They always come from admin product
    // ─────────────────────────────────────
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },

    productName: {
      type: String,
      required: true
      // READ ONLY - from admin product
    },

    productImage: {
      type: String,
      default: ""
      // READ ONLY - from admin product
    },

    productSku: {
      type: String,
      default: ""
      // READ ONLY - from admin product
    },

    category: {
      type: String,
      default: ""
      // READ ONLY - from admin product
    },

    subCategory: {
      type: String,
      default: ""
      // READ ONLY - from admin product
    },

    description: {
      type: String,
      default: ""
      // READ ONLY - from admin product
    },

    // ─────────────────────────────────────
    // PRICING
    // ─────────────────────────────────────
    originalPrice: {
      type: Number,
      required: true,
      min: 0
      // READ ONLY - price admin set
      // Seller sees this as reference
    },

    sellerPrice: {
      type: Number,
      required: true,
      min: 0
      // ✅ ONLY FIELD SELLER CAN EDIT
      // Seller sets their own selling price
      // Must be >= originalPrice (optional rule)
    },

    // ─────────────────────────────────────
    // STOCK (Controlled by system)
    // ─────────────────────────────────────
    totalStock: {
      type: Number,
      required: true,
      min: 0
      // Total units received from admin
      // READ ONLY - set when admin approves
    },

    availableStock: {
      type: Number,
      required: true,
      min: 0
      // Units available to sell
      // Decreases when customer buys
    },

    soldStock: {
      type: Number,
      default: 0
      // Units sold to customers
      // Increases when customer buys
    },

    // ─────────────────────────────────────
    // REQUEST REFERENCE
    // ─────────────────────────────────────
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SellerProductRequest",
      required: true
    },

    requestNumber: {
      type: String,
      default: ""
    },

    // ─────────────────────────────────────
    // PAYMENT INFO
    // ─────────────────────────────────────
    paymentType: {
      type: String,
      enum: ["PAY_NOW", "PAY_AFTER_DELIVERY"],
      required: true
    },

    paymentStatus: {
      type: String,
      enum: ["PAID", "PENDING"],
      default: "PENDING"
    },

    amountPaid: {
      type: Number,
      default: 0
    },

    // ─────────────────────────────────────
    // STATUS
    // ─────────────────────────────────────
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "OUT_OF_STOCK"],
      default: "ACTIVE"
    },

    // ─────────────────────────────────────
    // PRICE EDIT HISTORY (track changes)
    // ─────────────────────────────────────
    priceEditHistory: [
      {
        oldPrice: Number,
        newPrice: Number,
        editedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    approvedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// ─────────────────────────────────────
// AUTO UPDATE STATUS FROM STOCK
// ─────────────────────────────────────
sellerInventorySchema.pre("save", function (next) {
  if (this.availableStock === 0) {
    this.status = "OUT_OF_STOCK";
  } else if (
    this.status === "OUT_OF_STOCK" &&
    this.availableStock > 0
  ) {
    this.status = "ACTIVE";
  }
  next();
});

// ─────────────────────────────────────
// INDEXES
// ─────────────────────────────────────
sellerInventorySchema.index(
  { sellerId: 1, productId: 1, requestId: 1 },
  { unique: true }
);
sellerInventorySchema.index({ sellerId: 1, status: 1 });

const SellerInventory = mongoose.model(
  "SellerInventory",
  sellerInventorySchema
);

export default SellerInventory;
