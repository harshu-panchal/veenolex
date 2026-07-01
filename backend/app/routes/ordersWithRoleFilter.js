import express from "express";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import { attachRoleDateFilter } from "../middleware/roleDateFilter.js";
import Order from "../models/order.js";
import { applyRoleBasedFilter, getDataAccessInfo } from "../utils/roleBasedDataFilter.js";

const router = express.Router();

/**
 * GET /api/orders/seller-view
 * Shows orders based on user role:
 * - Sellers: Only last 40 days
 * - Admins: All orders
 */
router.get(
  "/seller-view",
  verifyToken,
  allowRoles("seller", "admin"),
  attachRoleDateFilter,
  async (req, res) => {
    try {
      const baseQuery = {
        seller: req.user.id  // For sellers, filter their own orders
      };
      
      // If admin, show all orders (no seller filter)
      if (req.user.role === "admin") {
        delete baseQuery.seller;
      }
      
      // Apply role-based date filter
      const finalQuery = applyRoleBasedFilter(baseQuery, req.user.role);
      
      // Fetch orders
      const orders = await Order.find(finalQuery)
        .sort({ createdAt: -1 })
        .lean();
      
      return res.json({
        success: true,
        count: orders.length,
        dataAccess: getDataAccessInfo(req.user.role),
        data: orders
      });
      
    } catch (error) {
      console.error("Error fetching orders:", error);
      return res.status(500).json({ message: "Error fetching orders" });
    }
  }
);

export default router;
