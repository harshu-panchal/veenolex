import express from "express";
import { handleShiprocketWebhook } from "../controller/deliveryWebhookController.js";

const router = express.Router();

router.post("/webhook/shiprocket", handleShiprocketWebhook);

export default router;
