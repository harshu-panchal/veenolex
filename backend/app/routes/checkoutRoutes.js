import express from "express";
import mongoose from "mongoose";
import Product from "../models/product.js";
import Order from "../models/order.js";
import User from "../models/customer.js";
import { checkProductAvailability } from "../../utils/locationService.js";
import { createShipRocketOrder } from "../../utils/shipRocketService.js";
import { WORKFLOW_STATUS, DEFAULT_SELLER_TIMEOUT_MS } from "../constants/orderWorkflow.js";
import { shiprocketQueue, JOB_NAMES } from "../queues/orderQueues.js";

const router = express.Router();

router.post("/process-order", async (req, res) => {
  try {
    const { userLocation, productId, quantity, userAddress, userDetails, userId, deliveryAddress } = req.body;
    
    // Resolve user details if userId is provided
    let resolvedUser = userDetails;
    const resolvedUserId = userId || userDetails?._id;
    if (resolvedUserId && mongoose.Types.ObjectId.isValid(resolvedUserId)) {
      const dbUser = await User.findById(resolvedUserId).lean();
      if (dbUser) {
        resolvedUser = dbUser;
      }
    }

    // Resolve address
    const resolvedAddress = userAddress || deliveryAddress;
    
    // 1. Get user's current location (from request)
    if (!userLocation || !userLocation.lat || !userLocation.lng) {
      return res.status(400).json({ success: false, message: "User location is required." });
    }

    // 2. Get product details (populate seller so we have serviceRadius and shipRocketPickupId)
    const product = await Product.findById(productId).populate("sellerId");
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    // Map sellerId reference to seller property for the locationService
    product.seller = product.sellerId;

    // 3. Call locationService.checkProductAvailability(product, userLocation)
    const availability = checkProductAvailability(product, userLocation);

    // 6. If result = NOT_AVAILABLE
    if (!availability.available) {
      return res.status(400).json({ success: false, message: "Product not available in your area" });
    }

    // Calculate base pricing
    const orderQuantity = quantity || 1;
    const baseTotal = product.price * orderQuantity;

    const sellerTimeoutMs = DEFAULT_SELLER_TIMEOUT_MS();
    const sellerPendingUntil = new Date(Date.now() + sellerTimeoutMs);

    // Initialize Order Document
    const order = new Order({
      orderId: "ORD" + Date.now(),
      customer: resolvedUser?._id || resolvedUserId || "000000000000000000000000", // Will be properly set via auth middleware normally
      seller: product.sellerId._id,
      items: [{
        product: product._id,
        name: product.name,
        quantity: orderQuantity,
        price: product.price,
        sku: product.sku
      }],
      address: {
        type: resolvedAddress?.type || "Home",
        name: resolvedAddress?.name || resolvedUser?.name || "Customer",
        address: resolvedAddress?.address || resolvedAddress?.fullAddress || "",
        city: resolvedAddress?.city || "",
        phone: resolvedAddress?.phone || resolvedUser?.phone || "",
        landmark: resolvedAddress?.landmark || "",
        location: resolvedAddress?.location || userLocation,
      },
      pricing: {
        subtotal: baseTotal,
        total: baseTotal,
        deliveryFee: 0
      },
      workflowVersion: 2,
      workflowStatus: WORKFLOW_STATUS.SELLER_PENDING,
      sellerPendingExpiresAt: sellerPendingUntil,
    });

    let responseData = {
      success: true,
      orderId: order.orderId,
    };

    // 4. If result = SELLER_DIRECT
    if (availability.deliveryType === "SELLER_DIRECT") {
      order.deliveryType = "SELLER_DIRECT";
      await order.save(); // Order goes to seller's dashboard directly
      
      responseData.deliveryType = "SELLER_DIRECT";
    } 
    // 5. If result = SHIPROCKET
    else if (availability.deliveryType === "SHIPROCKET") {
      order.deliveryType = "SHIPROCKET";
      order.isOutOfZone = true;
      order.shippingCost = availability.zoneOutPrice || 0;
      
      // Add shipping cost to order total
      order.pricing.deliveryFee = order.shippingCost;
      order.pricing.total += order.shippingCost;

      // Set "Shipment Pending" state immediately
      order.shipRocketDetails = {
        orderId: `PENDING_SR_${order._id}`,
        trackingNumber: "Assigning...",
        status: "PENDING",
        estimatedDelivery: null
      };
      await order.save();

      // Queue the creation background job or execute directly if Redis is disabled
      if (process.env.REDIS_DISABLED === "true") {
        try {
          const user = await User.findById(order.customer).lean();
          await createShipRocketOrder(order, user || {}, order.address, order.seller, order.items);
          console.log("🚀 Direct Shiprocket order created for order:", order._id);
        } catch (srErr) {
          console.error("❌ Direct Shiprocket creation failed:", srErr.message);
        }
      } else {
        await shiprocketQueue.add(
          JOB_NAMES.SHIPROCKET_CREATE,
          { type: "ORDER", id: order._id },
          {
            attempts: 5,
            backoff: {
              type: "exponential",
              delay: 5000
            }
          }
        );
      }

      responseData.deliveryType = "SHIPROCKET";
      responseData.trackingNumber = "Assigning...";
      responseData.estimatedDelivery = null;
      responseData.shippingCost = order.shippingCost;
    }

    return res.status(200).json(responseData);

  } catch (error) {
    console.error("Error processing checkout order:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
