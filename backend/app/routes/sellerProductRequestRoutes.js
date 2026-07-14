import express from "express";
import {
  createProductRequest,
  getSellerRequests,
  getSellerRequestById,
  getAllSellerRequests,
  approveSellerRequest,
  rejectSellerRequest,
  triggerDeliveryBroadcast,
  manualAssignDelivery,
  assignShiprocketDelivery
} from "../controller/sellerProductRequestController.js";
import {
  verifyToken,
  allowRoles
} from "../middleware/authMiddleware.js";

const router = express.Router();

// ─────────────────────────────────────────
// SELLER ROUTES
// ─────────────────────────────────────────

// POST /api/seller-requests/create
// Seller creates new product request
router.post(
  "/create",
  verifyToken,
  allowRoles("seller"),
  createProductRequest
);

// GET /api/seller-requests/my-requests
// Seller views their own requests
router.get(
  "/my-requests",
  verifyToken,
  allowRoles("seller"),
  getSellerRequests
);

// GET /api/seller-requests/my-requests/:requestId
// Seller views single request detail
router.get(
  "/my-requests/:requestId",
  verifyToken,
  allowRoles("seller"),
  getSellerRequestById
);

// ─────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────

// GET /api/seller-requests/admin/all
// Admin views all seller requests
router.get(
  "/admin/all",
  verifyToken,
  allowRoles("admin"),
  getAllSellerRequests
);

// PATCH /api/seller-requests/admin/:requestId/approve
// Admin approves a request
router.patch(
  "/admin/:requestId/approve",
  verifyToken,
  allowRoles("admin"),
  approveSellerRequest
);

// PATCH /api/seller-requests/admin/:requestId/reject
// Admin rejects a request
router.patch(
  "/admin/:requestId/reject",
  verifyToken,
  allowRoles("admin"),
  rejectSellerRequest
);

// PATCH /api/seller-requests/admin/:requestId/trigger-delivery
router.patch(
  "/admin/:requestId/trigger-delivery",
  verifyToken,
  allowRoles("admin"),
  triggerDeliveryBroadcast
);

// PATCH /api/seller-requests/admin/:requestId/assign-delivery
router.patch(
  "/admin/:requestId/assign-delivery",
  verifyToken,
  allowRoles("admin"),
  manualAssignDelivery
);

// PATCH /api/seller-requests/admin/:requestId/shiprocket-delivery
router.patch(
  "/admin/:requestId/shiprocket-delivery",
  verifyToken,
  allowRoles("admin"),
  assignShiprocketDelivery
);

export default router;
