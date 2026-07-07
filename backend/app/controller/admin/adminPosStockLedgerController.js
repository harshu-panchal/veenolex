/**
 * adminPosStockLedgerController.js — Admin POS Stock Ledger endpoints.
 *
 * Provides a read/write audit log of all POS inventory adjustments.
 */

import POSStockLedger from "../../models/posStockLedger.js";
import Product from "../../models/product.js";

/**
 * GET /admin/pos/stock-ledger — Fetch filterable, paginated stock ledger entries.
 */
export async function getStockLedger(req, res) {
  try {
    const {
      search = "",
      source,
      type,
      page = 1,
      limit = 50
    } = req.query;

    const query = {};

    if (source) query.source = source;
    if (type) query.type = type;

    if (search.trim()) {
      const term = search.trim();
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      query.$or = [
        { productName: regex },
        { sku: regex },
        { note: regex }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [entries, total] = await Promise.all([
      POSStockLedger.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("product", "name sku")
        .populate("order", "orderId")
        .populate("seller", "name shopName")
        .lean(),
      POSStockLedger.countDocuments(query)
    ]);

    return res.json({
      success: true,
      entries,
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
 * PUT /admin/pos/stock-ledger/:id — Edit/update note or details of a stock ledger entry.
 */
export async function updateStockLedgerEntry(req, res) {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const entry = await POSStockLedger.findById(id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "Stock ledger entry not found"
      });
    }

    if (note !== undefined) {
      entry.note = note;
    }

    await entry.save();

    return res.json({
      success: true,
      message: "Stock ledger entry updated successfully",
      entry
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
