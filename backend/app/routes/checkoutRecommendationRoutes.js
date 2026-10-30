import express from "express";
import {
  getPublicCheckoutRecommendations,
  getAdminCheckoutRecommendations,
  createCheckoutRecommendation,
  updateCheckoutRecommendation,
  deleteCheckoutRecommendation,
} from "../controller/checkoutRecommendationController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public Route
router.get("/", getPublicCheckoutRecommendations);

// Admin Routes (protected)
router.get("/admin", verifyToken, allowRoles("admin"), getAdminCheckoutRecommendations);
router.post("/admin", verifyToken, allowRoles("admin"), createCheckoutRecommendation);
router.put("/admin/:id", verifyToken, allowRoles("admin"), updateCheckoutRecommendation);
router.delete("/admin/:id", verifyToken, allowRoles("admin"), deleteCheckoutRecommendation);

export default router;

