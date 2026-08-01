import express from "express";
import multer from "multer";
import {
  getTodayBestPrices,
  getTodayBestPricesAdmin,
  createTodayBestPrice,
  updateTodayBestPrice,
  deleteTodayBestPrice,
  uploadTodayBestPriceImage,
} from "../controller/todayBestPriceController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Public Route
router.get("/", getTodayBestPrices);

// Admin Routes (protected)
router.get("/admin", verifyToken, allowRoles("admin"), getTodayBestPricesAdmin);
router.post("/admin", verifyToken, allowRoles("admin"), createTodayBestPrice);
router.put("/admin/:id", verifyToken, allowRoles("admin"), updateTodayBestPrice);
router.delete("/admin/:id", verifyToken, allowRoles("admin"), deleteTodayBestPrice);
router.post("/admin/upload-image", verifyToken, allowRoles("admin"), upload.single("image"), uploadTodayBestPriceImage);

export default router;
