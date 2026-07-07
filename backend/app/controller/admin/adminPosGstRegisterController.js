/**
 * adminPosGstRegisterController.js — Admin POS GST register endpoints.
 *
 * Tracks GST input tax credits (ITC) from purchase invoices.
 */

import GSTReportEntry from "../../models/gstReportEntry.js";

/**
 * GET /admin/reports/gst-register — Fetch GST register entries.
 */
export async function getGstRegister(req, res) {
  try {
    const {
      startDate,
      endDate,
      supplierGstin,
      page = 1,
      limit = 50
    } = req.query;

    const query = { seller: null }; // Admin only

    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) query.invoiceDate.$gte = new Date(startDate);
      if (endDate) query.invoiceDate.$lte = new Date(endDate);
    }

    if (supplierGstin) {
      query.supplierGstin = supplierGstin;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [entries, total] = await Promise.all([
      GSTReportEntry.find(query)
        .sort({ invoiceDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      GSTReportEntry.countDocuments(query)
    ]);

    // Sum totals for the filtered set (or overall if no filters)
    const summaryAgg = await GSTReportEntry.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalTaxable: { $sum: "$taxableAmount" },
          totalCgst: { $sum: "$cgst" },
          totalSgst: { $sum: "$sgst" },
          totalIgst: { $sum: "$igst" },
          totalTax: { $sum: "$totalTax" },
          totalAmount: { $sum: "$totalAmount" }
        }
      }
    ]);

    const summary = summaryAgg[0] || {
      totalTaxable: 0,
      totalCgst: 0,
      totalSgst: 0,
      totalIgst: 0,
      totalTax: 0,
      totalAmount: 0
    };

    return res.json({
      success: true,
      entries,
      summary,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * POST /admin/reports/gst-register — Create a new GST register invoice entry.
 */
export async function createGstRegisterEntry(req, res) {
  try {
    const {
      invoiceNumber,
      invoiceDate,
      supplierName,
      supplierGstin,
      taxableAmount,
      cgst,
      sgst,
      igst,
      hsnCode,
      note
    } = req.body;

    const amtTaxable = Number(taxableAmount || 0);
    const amtCgst = Number(cgst || 0);
    const amtSgst = Number(sgst || 0);
    const amtIgst = Number(igst || 0);
    const totalTax = amtCgst + amtSgst + amtIgst;
    const totalAmount = amtTaxable + totalTax;

    const entry = await GSTReportEntry.create({
      invoiceNumber,
      invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
      supplierName,
      supplierGstin,
      taxableAmount: amtTaxable,
      cgst: amtCgst,
      sgst: amtSgst,
      igst: amtIgst,
      totalTax,
      totalAmount,
      hsnCode,
      note,
      createdBy: req.user?._id,
      createdByRole: "Admin",
      seller: null
    });

    return res.status(201).json({
      success: true,
      message: "GST Register entry created successfully",
      entry
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * PATCH /admin/reports/gst-register/:id — Update a GST register entry.
 */
export async function updateGstRegisterEntry(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const entry = await GSTReportEntry.findById(id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "GST entry not found"
      });
    }

    // Merge changes
    if (updates.invoiceNumber !== undefined) entry.invoiceNumber = updates.invoiceNumber;
    if (updates.invoiceDate !== undefined) entry.invoiceDate = new Date(updates.invoiceDate);
    if (updates.supplierName !== undefined) entry.supplierName = updates.supplierName;
    if (updates.supplierGstin !== undefined) entry.supplierGstin = updates.supplierGstin;
    if (updates.hsnCode !== undefined) entry.hsnCode = updates.hsnCode;
    if (updates.note !== undefined) entry.note = updates.note;

    if (
      updates.taxableAmount !== undefined ||
      updates.cgst !== undefined ||
      updates.sgst !== undefined ||
      updates.igst !== undefined
    ) {
      const amtTaxable = updates.taxableAmount !== undefined ? Number(updates.taxableAmount) : entry.taxableAmount;
      const amtCgst = updates.cgst !== undefined ? Number(updates.cgst) : entry.cgst;
      const amtSgst = updates.sgst !== undefined ? Number(updates.sgst) : entry.sgst;
      const amtIgst = updates.igst !== undefined ? Number(updates.igst) : entry.igst;

      entry.taxableAmount = amtTaxable;
      entry.cgst = amtCgst;
      entry.sgst = amtSgst;
      entry.igst = amtIgst;
      entry.totalTax = amtCgst + amtSgst + amtIgst;
      entry.totalAmount = amtTaxable + entry.totalTax;
    }

    await entry.save();

    return res.json({
      success: true,
      message: "GST entry updated successfully",
      entry
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * DELETE /admin/reports/gst-register/:id — Delete a GST register entry.
 */
export async function deleteGstRegisterEntry(req, res) {
  try {
    const { id } = req.params;

    const entry = await GSTReportEntry.findByIdAndDelete(id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "GST entry not found"
      });
    }

    return res.json({
      success: true,
      message: "GST Register entry deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
