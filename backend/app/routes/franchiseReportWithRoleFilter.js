import express from "express";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import { attachRoleDateFilter } from "../middleware/roleDateFilter.js";
import Order from "../models/order.js";
import { applyRoleBasedFilter, getDataAccessInfo } from "../utils/roleBasedDataFilter.js";

const router = express.Router();

/**
 * GET /api/reports/franchises-with-role-filter
 * Shows franchise data based on user role
 * Sellers: Only franchises from last 40 days
 * Admins: All franchise data
 */
router.get(
  "/franchises-with-role-filter",
  verifyToken,
  allowRoles("admin", "seller"),
  attachRoleDateFilter,
  async (req, res) => {
    try {
      const matchStage = {};
      
      // Apply role-based date filter
      const dateFilter = req.dateFilter || {};
      if (Object.keys(dateFilter).length > 0) {
        matchStage.createdAt = dateFilter.createdAt;
      }
      
      // If seller, only their orders
      if (req.user.role === "seller") {
        matchStage.seller = req.user.id;
      }
      
      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: "$seller",
            totalOrders: { $sum: 1 },
            onlineOrders: {
              $sum: {
                $cond: [
                  { $or: [ { $ifNull: ["$posPaymentMethod", false] }, { $regexMatch: { input: { $ifNull: ["$adminNotes", ""] }, regex: /POS/i } } ] },
                  0,
                  1
                ]
              }
            },
            offlineOrders: {
              $sum: {
                $cond: [
                  { $or: [ { $ifNull: ["$posPaymentMethod", false] }, { $regexMatch: { input: { $ifNull: ["$adminNotes", ""] }, regex: /POS/i } } ] },
                  1,
                  0
                ]
              }
            },
            totalRevenue: {
              $sum: { $ifNull: ["$paymentBreakdown.grandTotal", "$pricing.total"] }
            },
            onlineRevenue: {
              $sum: {
                $cond: [
                  { $or: [ { $ifNull: ["$posPaymentMethod", false] }, { $regexMatch: { input: { $ifNull: ["$adminNotes", ""] }, regex: /POS/i } } ] },
                  0,
                  { $ifNull: ["$paymentBreakdown.grandTotal", "$pricing.total"] }
                ]
              }
            },
            offlineRevenue: {
              $sum: {
                $cond: [
                  { $or: [ { $ifNull: ["$posPaymentMethod", false] }, { $regexMatch: { input: { $ifNull: ["$adminNotes", ""] }, regex: /POS/i } } ] },
                  { $ifNull: ["$paymentBreakdown.grandTotal", "$pricing.total"] },
                  0
                ]
              }
            },
            totalTransactions: {
              $sum: {
                $cond: [
                  { $in: ["$paymentStatus", ["PAID", "CASH_COLLECTED"]] },
                  1,
                  0
                ]
              }
            },
            earliestOrder: { $min: "$createdAt" }
          }
        },
        {
          $lookup: {
            from: "sellers",
            localField: "_id",
            foreignField: "_id",
            as: "sellerInfo"
          }
        },
        { $unwind: { path: "$sellerInfo", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            franchiseId: { $ifNull: ["$_id", "Unknown"] },
            franchiseName: {
              $ifNull: ["$sellerInfo.businessName", "$sellerInfo.name", "Unknown"]
            },
            totalOrders: 1,
            onlineOrders: 1,
            offlineOrders: 1,
            totalRevenue: { $round: ["$totalRevenue", 2] },
            onlineRevenue: { $round: ["$onlineRevenue", 2] },
            offlineRevenue: { $round: ["$offlineRevenue", 2] },
            totalTransactions: 1,
            status: { $ifNull: ["$sellerInfo.status", "unknown"] },
            createdDate: { $ifNull: ["$sellerInfo.createdAt", "$earliestOrder"] }
          }
        },
        { $sort: { totalRevenue: -1 } }
      ];
      
      const results = await Order.aggregate(pipeline);
      
      return res.json({
        success: true,
        count: results.length,
        dataAccess: getDataAccessInfo(req.user.role),
        data: results
      });
      
    } catch (error) {
      console.error("Franchise report error:", error);
      return res.status(500).json({ message: "Error fetching franchise report" });
    }
  }
);

export default router;
