import express from "express";
import { verifyToken, allowRoles, requireApprovedSeller } from "../middleware/authMiddleware.js";
import {
  createSellerPOSOrder,
  getSellerPOSState,
  updateSellerPOSState,
  getSellerPOSBillSettings,
  updateSellerPOSBillSettings,
  getSellerPOSCustomers,
  createSellerPOSCustomer,
  getSellerPOSProducts,
  getSellerPOSInvoiceReport,
  getSellerOwnedCategories,
  createSellerOwnedCategory,
  deleteSellerOwnedCategory,
  getSellerOwnedSubCategories,
  createSellerOwnedSubCategory,
  initiateSellerCreditPhonePeRepayment,
  verifySellerCreditPhonePeRepayment
} from "../controller/sellerPosController.js";

const router = express.Router();

// Require seller token
router.use(verifyToken);
router.use(allowRoles("seller"));

// Allow operational actions for active sellers (except settings checks)
router.use(requireApprovedSeller);

// ── POS Orders ────────────────────────────────────────────────────────
router.post("/orders", createSellerPOSOrder);
router.get("/orders/pos-report", getSellerPOSInvoiceReport);

// ── POS State Sync ───────────────────────────────────────────────────
router.get("/state", getSellerPOSState);
router.put("/state", updateSellerPOSState);

// ── POS Bill Settings ─────────────────────────────────────────────────
router.get("/bill-settings", getSellerPOSBillSettings);
router.put("/bill-settings", updateSellerPOSBillSettings);

// ── POS Customers ─────────────────────────────────────────────────────
router.get("/customers", getSellerPOSCustomers);
router.post("/customers", createSellerPOSCustomer);
router.post("/credit/payment/initiate", initiateSellerCreditPhonePeRepayment);
router.post("/credit/payment/verify", verifySellerCreditPhonePeRepayment);

// ── POS Catalog ───────────────────────────────────────────────────────
router.get("/products", getSellerPOSProducts);

// ── POS Owned Categories ──────────────────────────────────────────────
router.get("/own-categories", getSellerOwnedCategories);
router.post("/own-categories", createSellerOwnedCategory);
router.delete("/own-categories/:id", deleteSellerOwnedCategory);

// ── POS Owned SubCategories ───────────────────────────────────────────
router.get("/own-subcategories", getSellerOwnedSubCategories);
router.post("/own-subcategories", createSellerOwnedSubCategory);

export default router;
