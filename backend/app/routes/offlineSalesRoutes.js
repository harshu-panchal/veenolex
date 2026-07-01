import express from "express";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
  recordOfflineSale,
  getOfflineSalesHistory,
  getOfflineSalesStats,
  deleteOfflineSale
} from "../utils/offlineSalesService.js";

const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// POST /api/offline-sales/record
// Record a new offline sale
// ═══════════════════════════════════════════════════════════════
router.post(
  "/record",
  verifyToken,
  allowRoles("seller"),
  async (req, res) => {
    try {
      console.log("📥 Recording offline sale request...");

      const { items, paymentMethod, customerName, customerPhone, notes } = req.body;

      // VALIDATION
      if (!items || !Array.isArray(items) || items.length === 0 || !customerName || !customerPhone) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: items (array), customerName, customerPhone"
        });
      }

      // Validate items
      for (const item of items) {
        if (!item.productId || !item.quantity || item.quantity <= 0) {
          return res.status(400).json({
            success: false,
            message: "Each item must have a valid productId and a quantity greater than 0"
          });
        }
      }

      // VALIDATE PHONE NUMBER (Basic Indian format)
      const phoneRegex = /^\+?[0-9]{10,13}$/;
      if (!phoneRegex.test(customerPhone.replace(/\D/g, ""))) {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number format"
        });
      }

      // Call service to record sale
      const result = await recordOfflineSale({
        sellerId: req.user.id,  // From authenticated user
        items: items.map(item => ({
          productId: item.productId,
          quantity: parseInt(item.quantity)
        })),
        paymentMethod: paymentMethod || "CASH",
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        notes: notes || ""
      });

      // Return success response
      return res.status(200).json(result);

    } catch (error) {
      console.error("❌ Error recording sale:", error.message);
      return res.status(400).json({
        success: false,
        message: error.message || "Failed to record offline sale"
      });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// GET /api/offline-sales/history
// Get all offline sales for this seller
// ═══════════════════════════════════════════════════════════════
router.get(
  "/history",
  verifyToken,
  allowRoles("seller", "admin"),
  async (req, res) => {
    try {
      console.log("📋 Fetching offline sales history...");

      const { productId, startDate, endDate } = req.query;

      // Determine which seller to fetch for
      const sellerId = req.user.role === "admin" && req.query.sellerId
        ? req.query.sellerId
        : req.user.id;

      // Build filters
      const filters = {};
      if (productId) filters.productId = productId;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      // Fetch history
      const sales = await getOfflineSalesHistory(sellerId, filters);

      // Calculate summary
      const summary = {
        totalSales: sales.length,
        totalRevenue: sales.reduce((sum, sale) => sum + sale.totalAmount, 0),
        totalQuantity: sales.reduce((sum, sale) => sum + sale.quantity, 0)
      };

      return res.status(200).json({
        success: true,
        count: sales.length,
        summary: summary,
        data: sales
      });

    } catch (error) {
      console.error("❌ Error fetching history:", error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch offline sales history"
      });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// GET /api/offline-sales/stats
// Get statistics for offline sales
// ═══════════════════════════════════════════════════════════════
router.get(
  "/stats",
  verifyToken,
  allowRoles("seller", "admin"),
  async (req, res) => {
    try {
      console.log("📊 Fetching offline sales stats...");

      const { days = 30 } = req.query;

      // Determine seller
      const sellerId = req.user.role === "admin" && req.query.sellerId
        ? req.query.sellerId
        : req.user.id;

      // Get stats
      const stats = await getOfflineSalesStats(sellerId, parseInt(days));

      return res.status(200).json({
        success: true,
        period: `${days} days`,
        stats: stats
      });

    } catch (error) {
      console.error("❌ Error fetching stats:", error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch offline sales statistics"
      });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// DELETE /api/offline-sales/:saleId
// Delete an offline sale (and restore stock)
// ═══════════════════════════════════════════════════════════════
router.delete(
  "/:saleId",
  verifyToken,
  allowRoles("seller", "admin"),
  async (req, res) => {
    try {
      console.log("🗑️ Deleting offline sale:", req.params.saleId);

      // Delete and restore stock
      const result = await deleteOfflineSale(req.params.saleId);

      return res.status(200).json(result);

    } catch (error) {
      console.error("❌ Error deleting sale:", error.message);
      return res.status(400).json({
        success: false,
        message: error.message || "Failed to delete offline sale"
      });
    }
  }
);

export default router;
