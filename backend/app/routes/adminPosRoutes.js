import express from "express";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
  createAdminPOSOrder,
  updateAdminPOSOrderItems,
  exchangeAdminPOSItems,
  deleteAdminPOSOrder,
  getAdminPOSProducts,
  getAdminPOSProductByBarcode,
  getAdminPOSReport,
  getAdminPOSInvoiceReport,
  createAdminPOSOnlineOrder,
  verifyAdminPOSPayment
} from "../controller/admin/adminPosOrderController.js";
import {
  getCreditCustomers,
  getCreditHistory,
  addCredit,
  recordCreditPayment,
  initiateAdminCreditPhonePeRepayment,
  verifyAdminCreditPhonePeRepayment
} from "../controller/admin/adminPosCreditController.js";
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  recordSupplierDebt,
  recordSupplierPayment
} from "../controller/admin/adminPosSupplierController.js";
import {
  getPurchaseEntries,
  savePurchaseEntry,
  deletePurchaseEntry
} from "../controller/admin/adminPosPurchaseController.js";
import {
  getStockLedger,
  updateStockLedgerEntry
} from "../controller/admin/adminPosStockLedgerController.js";
import {
  getGstRegister,
  createGstRegisterEntry,
  updateGstRegisterEntry,
  deleteGstRegisterEntry
} from "../controller/admin/adminPosGstRegisterController.js";

const router = express.Router();

// All routes require authentication and admin role
router.use(verifyToken);
router.use(allowRoles("admin"));

// ── POS Orders ────────────────────────────────────────────────────────
router.post("/orders/pos", createAdminPOSOrder);
router.post("/orders/pos/online", createAdminPOSOnlineOrder);
router.post("/orders/pos/verify", verifyAdminPOSPayment);
router.patch("/orders/:id/items", updateAdminPOSOrderItems);
router.post("/pos/exchange", exchangeAdminPOSItems);
router.delete("/orders/pos/:id", deleteAdminPOSOrder);
router.get("/orders/pos-report", getAdminPOSInvoiceReport);

// ── POS Catalog ───────────────────────────────────────────────────────
router.get("/products/pos", getAdminPOSProducts);
router.get("/products/pos/barcode", getAdminPOSProductByBarcode);

// ── POS Report ────────────────────────────────────────────────────────
router.get("/pos/report", getAdminPOSReport);

// ── POS Stock Ledger ──────────────────────────────────────────────────
router.get("/pos/stock-ledger", getStockLedger);
router.put("/pos/stock-ledger/:id", updateStockLedgerEntry);

// ── POS Purchase Entries ──────────────────────────────────────────────
router.get("/pos/purchase-entries", getPurchaseEntries);
router.post("/pos/purchase-entries", savePurchaseEntry);
router.delete("/pos/purchase-entries/:id", deletePurchaseEntry);

// ── POS Credit / Udhaar ───────────────────────────────────────────────
router.get("/pos/credit/customers", getCreditCustomers);
router.get("/pos/credit/history/:customerId", getCreditHistory);
router.post("/pos/credit/add", addCredit);
router.post("/pos/credit/payment", recordCreditPayment);
router.post("/pos/credit/payment/initiate", initiateAdminCreditPhonePeRepayment);
router.post("/pos/credit/payment/verify", verifyAdminCreditPhonePeRepayment);

// ── POS Suppliers ─────────────────────────────────────────────────────
router.get("/pos/suppliers", getSuppliers);
router.post("/pos/suppliers", createSupplier);
router.get("/pos/suppliers/:id", getSupplierById);
router.put("/pos/suppliers/:id", updateSupplier);
router.delete("/pos/suppliers/:id", deleteSupplier);
router.post("/pos/suppliers/:id/debt", recordSupplierDebt);
router.post("/pos/suppliers/:id/pay", recordSupplierPayment);

// ── POS GST Register ──────────────────────────────────────────────────
router.get("/reports/gst-register", getGstRegister);
router.post("/reports/gst-register", createGstRegisterEntry);
router.patch("/reports/gst-register/:id", updateGstRegisterEntry);
router.delete("/reports/gst-register/:id", deleteGstRegisterEntry);

export default router;
