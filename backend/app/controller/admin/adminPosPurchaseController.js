/**
 * adminPosPurchaseController.js — Admin POS Purchase Entry & Quotation endpoints.
 *
 * Handles purchase drafts, quotation drafts, and executing stock-in from
 * purchase entries.
 */

import AdminPurchaseEntry from "../../models/adminPurchaseEntry.js";
import { incrementVariantStock } from "../../services/pos/variantStockService.js";

/**
 * GET /admin/pos/purchase-entries — List purchase/quotation entries.
 */
export async function getPurchaseEntries(req, res) {
  try {
    const { type } = req.query; // 'purchase' or 'quotation'

    const filter = { createdBy: req.user?._id };
    if (type) {
      filter.type = type;
    }

    const entries = await AdminPurchaseEntry.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      entries
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * POST /admin/pos/purchase-entries — Create/Save a new purchase/quotation draft.
 * Also handles committing stock-in if it's a purchase.
 */
export async function savePurchaseEntry(req, res) {
  try {
    const { type, data, commitStock = false } = req.body;

    if (!type || !["purchase", "quotation"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid type. Must be 'purchase' or 'quotation'"
      });
    }

    const entry = await AdminPurchaseEntry.create({
      type,
      data,
      createdBy: req.user?._id
    });

    // If commitStock is true and it's a purchase, adjust product stocks
    if (type === "purchase" && commitStock && data && Array.isArray(data.items)) {
      for (const item of data.items) {
        if (item.productId) {
          const qty = Number(item.quantity);
          if (qty > 0) {
            await incrementVariantStock({
              productId: item.productId,
              variantId: item.variationId || null,
              quantity: qty,
              source: "PURCHASE",
              note: `Stock-in from Admin Purchase Entry #${entry._id}`,
              sellerId: null
            });
          }
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: `${type === "purchase" ? "Purchase" : "Quotation"} entry saved successfully`,
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
 * DELETE /admin/pos/purchase-entries/:id — Delete a purchase/quotation draft.
 */
export async function deletePurchaseEntry(req, res) {
  try {
    const { id } = req.params;

    const entry = await AdminPurchaseEntry.findOneAndDelete({
      _id: id,
      createdBy: req.user?._id
    });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "Entry not found or unauthorized"
      });
    }

    return res.json({
      success: true,
      message: "Entry deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
