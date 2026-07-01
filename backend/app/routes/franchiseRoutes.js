import express from "express";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import Order from "../models/order.js";

const router = express.Router();

/**
 * GET /api/admin/reports/franchises
 *
 * Returns an aggregated franchise (seller) report within a date range.
 * Query params:
 *   - fromDate  (ISO string, e.g. "2026-01-01")
 *   - toDate    (ISO string, e.g. "2026-06-30")
 *
 * Response: Array of objects with:
 *   franchiseId, franchiseName, totalOrders, totalRevenue,
 *   totalTransactions, status, createdDate
 */
router.get(
  "/franchises",
  verifyToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const { fromDate, toDate } = req.query;

      // Build date filter
      const dateFilter = {};
      if (fromDate) dateFilter.$gte = new Date(fromDate);
      if (toDate) {
        // Include the entire "toDate" day
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }

      const matchStage = {};
      if (Object.keys(dateFilter).length > 0) {
        matchStage.createdAt = dateFilter;
      }

      const pipeline = [
        // 1. Filter by date range (if provided)
        ...(Object.keys(matchStage).length > 0
          ? [{ $match: matchStage }]
          : []),

        // 2. Group by seller (franchise)
        {
          $group: {
            _id: "$seller",
            totalOrders: { $sum: 1 },
            totalRevenue: {
              $sum: {
                $ifNull: ["$paymentBreakdown.grandTotal", "$pricing.total"],
              },
            },
            totalTransactions: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      "$paymentStatus",
                      ["PAID", "CASH_COLLECTED", "COD_RECONCILED"],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            earliestOrder: { $min: "$createdAt" },
          },
        },

        // 3. Lookup seller details
        {
          $lookup: {
            from: "sellers",
            localField: "_id",
            foreignField: "_id",
            as: "sellerInfo",
          },
        },
        { $unwind: { path: "$sellerInfo", preserveNullAndEmptyArrays: true } },

        // 4. Project the final shape
        {
          $project: {
            _id: 0,
            franchiseId: { $ifNull: ["$_id", "Unknown"] },
            franchiseName: {
              $ifNull: [
                "$sellerInfo.businessName",
                "$sellerInfo.name",
                "Unknown Seller",
              ],
            },
            totalOrders: 1,
            totalRevenue: { $round: ["$totalRevenue", 2] },
            totalTransactions: 1,
            status: {
              $ifNull: ["$sellerInfo.status", "unknown"],
            },
            createdDate: {
              $ifNull: ["$sellerInfo.createdAt", "$earliestOrder"],
            },
          },
        },

        // 5. Sort by revenue descending
        { $sort: { totalRevenue: -1 } },
      ];

      const results = await Order.aggregate(pipeline);

      return res.status(200).json({
        success: true,
        count: results.length,
        data: results,
      });
    } catch (err) {
      console.error("[FranchiseReport] Error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to generate franchise report.",
        error: err.message,
      });
    }
  }
);

export default router;
