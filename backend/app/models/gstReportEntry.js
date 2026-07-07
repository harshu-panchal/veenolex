import mongoose from "mongoose";

/**
 * GSTReportEntry — purchase GST register for POS.
 *
 * Stores individual GST line items from purchase invoices,
 * allowing admin/seller to maintain a GST register for compliance.
 */
const gstReportEntrySchema = new mongoose.Schema(
  {
    invoiceNumber: String,
    invoiceDate: Date,
    supplierName: String,
    supplierGstin: String,
    taxableAmount: {
      type: Number,
      default: 0,
    },
    cgst: {
      type: Number,
      default: 0,
    },
    sgst: {
      type: Number,
      default: 0,
    },
    igst: {
      type: Number,
      default: 0,
    },
    totalTax: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    hsnCode: String,
    note: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
    },
    createdByRole: {
      type: String,
      enum: ["Admin", "Seller"],
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      default: null,  // null = admin entry
    },
  },
  { timestamps: true }
);

gstReportEntrySchema.index({ seller: 1, invoiceDate: -1 });
gstReportEntrySchema.index({ createdByRole: 1, createdAt: -1 });
gstReportEntrySchema.index({ supplierGstin: 1 });

export default mongoose.model("GSTReportEntry", gstReportEntrySchema);
