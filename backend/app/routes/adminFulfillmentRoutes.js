import express from "express";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
  listFulfillmentOrders,
  acceptFulfillmentOrder,
  rejectFulfillmentOrder,
  dispatchFulfillmentOrder,
  getWarehouseSettings,
  updateWarehouseSettings,
} from "../controller/admin/fulfillmentController.js";

// Admin warehouse fulfilment: orders no local seller could fulfil.
const router = express.Router();

router.use(verifyToken, allowRoles("admin"));

router.get("/orders", listFulfillmentOrders);
router.post("/orders/:orderId/accept", acceptFulfillmentOrder);
router.post("/orders/:orderId/reject", rejectFulfillmentOrder);
router.post("/orders/:orderId/dispatch", dispatchFulfillmentOrder);
router.get("/warehouse", getWarehouseSettings);
router.put("/warehouse", updateWarehouseSettings);

export default router;
