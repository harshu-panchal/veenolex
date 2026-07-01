import express from "express";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import { attachRoleDateFilter } from "../middleware/roleDateFilter.js";
import Order from "../models/order.js";
import { applyRoleBasedFilter, getDataAccessInfo } from "../utils/roleBasedDataFilter.js";

const router = express.Router();

/**
 * GET /api/reports/transaction-report
 * Seller sees: Last 40 days
 * Admin sees: All time
 */
router.get(
  "/transaction-report",
  verifyToken,
  allowRoles("seller", "admin"),
  attachRoleDateFilter,
  async (req, res) => {
    try {
      const baseQuery = {};
      
      // For sellers, only their transactions
      if (req.user.role === "seller") {
        baseQuery.seller = req.user.id;
      }
      
      // Apply role-based date filter (automatically adds 40-day limit for sellers)
      const finalQuery = applyRoleBasedFilter(baseQuery, req.user.role);
      
      // Aggregate transaction data
      const transactions = await Order.aggregate([
        { $match: finalQuery },
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            totalRevenue: { $sum: "$pricing.total" },
            avgOrderValue: { $avg: "$pricing.total" },
            byStatus: {
              $push: {
                status: "$paymentStatus",
                count: 1
              }
            }
          }
        }
      ]);
      
      return res.json({
        success: true,
        dataAccess: getDataAccessInfo(req.user.role),
        data: transactions[0] || { totalTransactions: 0, totalRevenue: 0 }
      });
      
    } catch (error) {
      console.error("Report fetch error:", error);
      return res.status(500).json({ message: "Error fetching report" });
    }
  }
);

/**
 * GET /api/reports/sales-report
 * Seller sees: Last 40 days sales
 * Admin sees: All time sales
 */
router.get(
  "/sales-report",
  verifyToken,
  allowRoles("seller", "admin"),
  attachRoleDateFilter,
  async (req, res) => {
    try {
      const baseQuery = {
        paymentStatus: { $in: ["PAID", "CASH_COLLECTED"] }
      };
      
      if (req.user.role === "seller") {
        baseQuery.seller = req.user.id;
      }
      
      const finalQuery = applyRoleBasedFilter(baseQuery, req.user.role);
      
      // Get sales data
      const salesData = await Order.find(finalQuery)
        .select("pricing createdAt paymentStatus")
        .sort({ createdAt: -1 });
      
      const totalSales = salesData.reduce((sum, order) => 
        sum + (order.pricing?.total || 0), 
        0
      );
      
      return res.json({
        success: true,
        dataAccess: getDataAccessInfo(req.user.role),
        totalOrders: salesData.length,
        totalSales: totalSales,
        avgOrderValue: salesData.length > 0 ? totalSales / salesData.length : 0,
        data: salesData
      });
      
    } catch (error) {
      console.error("Sales report error:", error);
      return res.status(500).json({ message: "Error fetching sales report" });
    }
  }
);

export default router;
