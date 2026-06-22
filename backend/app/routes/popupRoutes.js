import express from "express";
import multer from "multer";
import {
  getActivePopup,
  getPopups,
  createPopup,
  updatePopup,
  deletePopup,
  uploadPopupImage,
} from "../controller/popupController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Public Route
router.get("/active", getActivePopup);

// Admin Routes (protected)
router.get("/", verifyToken, allowRoles("admin"), getPopups);
router.post("/", verifyToken, allowRoles("admin"), createPopup);
router.put("/:id", verifyToken, allowRoles("admin"), updatePopup);
router.delete("/:id", verifyToken, allowRoles("admin"), deletePopup);
router.post("/upload-image", verifyToken, allowRoles("admin"), upload.single("image"), uploadPopupImage);

export default router;
