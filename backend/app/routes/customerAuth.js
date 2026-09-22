import express from "express";
import {
    signupCustomer,
    loginCustomer,
    verifyCustomerOTP,
    getCustomerProfile,
    updateCustomerProfile,
    updateLastLocation,
    getCustomerTransactions,
} from "../controller/customerAuthController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
    authRouteRateLimiter,
    createContentLengthGuard,
    otpRouteRateLimiter,
} from "../middleware/securityMiddlewares.js";

const router = express.Router();
const smallAuthPayload = createContentLengthGuard(
    parseInt(process.env.AUTH_MAX_PAYLOAD_BYTES || "16384", 10),
    "Auth payload too large",
);
router.post("/send-signup-otp", authRouteRateLimiter, otpRouteRateLimiter, smallAuthPayload, signupCustomer);
router.post("/send-login-otp", authRouteRateLimiter, otpRouteRateLimiter, smallAuthPayload, loginCustomer);
router.post("/verify-otp", authRouteRateLimiter, otpRouteRateLimiter, smallAuthPayload, verifyCustomerOTP);

// Profile routes
router.get("/profile", verifyToken, getCustomerProfile);
router.put("/profile", verifyToken, updateCustomerProfile);
router.put("/last-location", verifyToken, allowRoles("customer", "user"), smallAuthPayload, updateLastLocation);

// Wallet
router.get("/transactions", verifyToken, getCustomerTransactions);

export default router;
