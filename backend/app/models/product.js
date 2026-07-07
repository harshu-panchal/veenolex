import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        sku: {
            type: String,
            unique: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        salePrice: {
            type: Number,
            default: 0,
            min: 0,
        },
        stock: {
            type: Number,
            required: true,
            default: 0,
        },
        lowStockAlert: {
            type: Number,
            default: 5,
        },
        brand: {
            type: String,
            trim: true,
        },
        weight: {
            type: String,
            trim: true,
        },
        offerText: {
            type: String,
            trim: true,
            default: "",
        },
        marketedBy: {
            type: String,
            trim: true,
            default: "",
        },
        manufacturedBy: {
            type: String,
            trim: true,
            default: "",
        },
        bestBefore: {
            type: String,
            trim: true,
            default: "",
        },
        licenseNo: {
            type: String,
            trim: true,
            default: "",
        },
        ingredients: {
            type: String,
            trim: true,
            default: "",
        },
        tags: [{
            type: String,
            trim: true,
        }],
        mainImage: {
            type: String, // Cloudinary URL
        },
        galleryImages: [{
            type: String, // Array of Cloudinary URLs
        }],
        resultImages: [{
            type: String, // Array of Cloudinary URLs
        }],
        tabbedSections: [
            {
                title: {
                    type: String,
                    trim: true,
                },
                content: {
                    type: String,
                    trim: true,
                }
            }
        ],
        headerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },
        categoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },
        subcategoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },
        sellerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Seller",
            required: false, // Optional because Admin master catalog products do not have a seller
        },
        adminProductId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: false, // Set when this product is cloned from an admin master catalog product
        },
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active",
        },
        approvalStatus: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "approved",
        },
        approvalRequestedAt: {
            type: Date,
            default: null,
        },
        approvalReviewedAt: {
            type: Date,
            default: null,
        },
        approvalReviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
            default: null,
        },
        approvalNote: {
            type: String,
            trim: true,
            default: "",
        },
        lastSubmittedByRole: {
            type: String,
            enum: ["seller", "admin"],
            default: null,
        },
        // ── POS root-level fields ──────────────────────────────────────
        barcode: [{ type: String, trim: true }],
        hsnCode: { type: String, trim: true },
        gst: { type: Number, default: 0 },
        itemCode: { type: String, trim: true },
        variants: [
            {
                name: String,
                price: Number,
                salePrice: Number,
                stock: Number,
                sku: String,
                // ── POS variant extensions ─────────────────────────────
                purchasePrice: Number,
                wholesalePrice: Number,
                discPrice: Number,
                compareAtPrice: Number,
                barcode: [{ type: String }],
                mainImage: String,
            }
        ],
        isFeatured: {
            type: Boolean,
            default: false,
        },
        zoneOutDeliveryEnabled: {
            type: Boolean,
            default: true  // Allow products to be shown outside service radius
        },
        shippingPartner: {
            type: String,
            enum: ["SELLER", "SHIPROCKET"],
            default: "SELLER"
        },
        zoneOutPrice: {
            type: Number,
            default: null  // Extra charge for out-of-zone delivery (if any)
        }
    },
    { timestamps: true }
);

// Optimize performance for common queries on home/search pages
productSchema.index({ status: 1, isFeatured: 1, createdAt: -1 });
productSchema.index({ status: 1, createdAt: -1, _id: -1 });
productSchema.index({ approvalStatus: 1, status: 1, createdAt: -1 });
productSchema.index({ headerId: 1, status: 1 });
productSchema.index({ categoryId: 1, status: 1 });
productSchema.index({ subcategoryId: 1, status: 1 });
productSchema.index({ sellerId: 1, status: 1 });
productSchema.index({ sellerId: 1, approvalStatus: 1, createdAt: -1 });
productSchema.index({ sellerId: 1, createdAt: -1, _id: -1 });
productSchema.index({ name: "text", tags: "text" }); // For better search if regex is too slow

export default mongoose.model("Product", productSchema);
