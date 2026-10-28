import Coupon from "../models/coupon.js";
import handleResponse from "../utils/helper.js";
import Cart from "../models/cart.js";
import { buildSearchRegex } from "../utils/regex.js";
import { computeOrderDiscount } from "../services/finance/couponService.js";
import { hydrateOrderItems } from "../services/finance/pricingService.js";

export const listCoupons = async (req, res) => {
    try {
        const { status, search } = req.query;
        const query = {};

        if (status === "active") {
            const now = new Date();
            query.isActive = true;
            query.validFrom = { $lte: now };
            query.validTill = { $gte: now };
        } else if (status === "expired") {
            query.$or = [{ isActive: false }, { validTill: { $lt: new Date() } }];
        }

        if (search) {
            const term = search.trim();
            // P3-5: substring search preserved; user input is regex-escaped.
            const safe = buildSearchRegex(term, { anchored: false });
            query.$or = [
                { code: safe },
                { title: safe },
                { description: safe },
            ];
        }

        const coupons = await Coupon.find(query).sort({ createdAt: -1 }).lean();
        return handleResponse(res, 200, "Coupons fetched successfully", coupons);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const createCoupon = async (req, res) => {
    try {
        const data = { ...req.body };
        const coupon = await Coupon.create(data);
        return handleResponse(res, 201, "Coupon created successfully", coupon);
    } catch (error) {
        if (error.code === 11000) {
            return handleResponse(res, 400, "Coupon code already exists");
        }
        return handleResponse(res, 500, error.message);
    }
};

export const updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const data = { ...req.body };
        const coupon = await Coupon.findByIdAndUpdate(id, data, {
            new: true,
            runValidators: true,
        });
        if (!coupon) {
            return handleResponse(res, 404, "Coupon not found");
        }
        return handleResponse(res, 200, "Coupon updated successfully", coupon);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        await Coupon.findByIdAndDelete(id);
        return handleResponse(res, 200, "Coupon deleted successfully");
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Simple validation engine for checkout
export const validateCoupon = async (req, res) => {
    try {
        const { code, items, customerId } = req.body;

        if (!code) {
            return handleResponse(res, 400, "Coupon code is required");
        }

        // Every coupon decision — here and at place-order — runs through the
        // centralized engine, so this endpoint uses the SAME validation, the
        // SAME per-user counts (from `Order.coupon`) and the SAME discount
        // math. The endpoint previously did its own math on a client-supplied
        // `cartTotal`/`items`, with `Math.round` instead of `roundCurrency`
        // and a per-user count hard-coded to 0.
        //
        // Cart hydration priority:
        //   1. Server-side `Cart` collection for the customer (most trusted).
        //      Picked when a customer is resolvable AND a cart exists.
        //   2. Client-supplied `items` array, hydrated through
        //      `hydrateOrderItems` (server prices replace client prices) —
        //      the fallback for flows that don't sync the cart first.
        const effectiveCustomerId = customerId || req.user?.id || null;
        let hydratedItems = [];

        if (effectiveCustomerId) {
            const serverCart = await Cart.findOne({ customerId: effectiveCustomerId }).lean();
            if (serverCart && Array.isArray(serverCart.items) && serverCart.items.length > 0) {
                const cartItemsForHydration = serverCart.items.map((item) => ({
                    product: item.productId,
                    variantSku: String(item.variantSku || "").trim(),
                    quantity: item.quantity,
                }));
                hydratedItems = await hydrateOrderItems(cartItemsForHydration, {
                    enforceServerPricing: true,
                });
            }
        }

        if (hydratedItems.length === 0 && Array.isArray(items) && items.length > 0) {
            hydratedItems = await hydrateOrderItems(items, {
                enforceServerPricing: true,
            });
        }

        if (hydratedItems.length === 0) {
            return handleResponse(res, 400, "Cannot apply a coupon to an empty cart");
        }

        const result = await computeOrderDiscount({
            couponCode: code,
            customerId: effectiveCustomerId,
            hydratedItems,
        });
        if (!result) {
            return handleResponse(res, 400, "Invalid coupon code");
        }
        return handleResponse(res, 200, "Coupon applied", {
            couponId: result.coupon._id,
            code: result.coupon.code,
            discountAmount: result.discountAmount,
            freeDelivery: result.freeDelivery,
            couponSnapshot: result.couponSnapshot,
        });
    } catch (error) {
        // Honor `error.statusCode` so the engine's 400/404 errors (e.g.
        // "Coupon not active", "Minimum order value should be ₹500") surface
        // as the intended HTTP status. Throws without a `statusCode` stay
        // 500 — unexpected DB/system failures.
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

