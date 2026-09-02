
import SellerProductRequest from
  "../models/sellerProductRequest.js";
import Product from "../models/product.js";
import Seller from "../models/seller.js";
import SellerInventory from "../models/sellerInventory.js";
import { emitToDelivery } from "../services/orderSocketEmitter.js";
import { emitNotificationEvent } from "../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";
import Notification from "../models/notification.js";
import Delivery from "../models/delivery.js";
import { startRequestDeliverySearch } from "../services/orderWorkflowService.js";
import { getActivePaymentProvider } from "../services/payment/providerRegistry.js";
import { createShipRocketOrderForRequest } from "../../utils/shipRocketService.js";
import { shiprocketQueue, JOB_NAMES } from "../queues/orderQueues.js";

// ═══════════════════════════════════════════════
// SELLER: CREATE NEW PRODUCT REQUEST
// ═══════════════════════════════════════════════
export const createProductRequest = async (req, res) => {
  try {
    console.log("📦 Creating seller product request...");

    const { items, paymentType, sellerNote } = req.body;
    const sellerId = req.user.id;

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one product"
      });
    }

    if (!["PAY_NOW", "PAY_AFTER_DELIVERY"].includes(paymentType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment type"
      });
    }

    // Fetch seller info
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found"
      });
    }

    // Process items and calculate totals
    let subtotal = 0;
    const processedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.productId}`
        });
      }

      let unitPrice = 0;
      if (Array.isArray(product.variants) && product.variants.length > 0) {
        let matchedVariant = product.variants[0];
        if (item.variantSku) {
          const found = product.variants.find(
            (v) => String(v.sku || "").trim() === String(item.variantSku).trim()
          );
          if (found) matchedVariant = found;
        }
        const vSellerPrice = Number(matchedVariant?.sellerPrice);
        if (!isNaN(vSellerPrice) && vSellerPrice > 0) {
          unitPrice = vSellerPrice;
        } else {
          unitPrice = Number(matchedVariant?.salePrice || matchedVariant?.price) || 0;
        }
      }

      if (!unitPrice || unitPrice <= 0) {
        const pSellerPrice = Number(product.sellerPrice);
        if (!isNaN(pSellerPrice) && pSellerPrice > 0) {
          unitPrice = pSellerPrice;
        } else {
          unitPrice = Number(product.salePrice || product.price) || 0;
        }
      }

      const itemTotal = unitPrice * item.quantity;
      subtotal += itemTotal;

      processedItems.push({
        productId: product._id,
        productName: product.name,
        productImage: product.mainImage || product.images?.[0] || "",
        category: product.category || "",
        pricePerUnit: unitPrice,
        quantity: item.quantity,
        totalPrice: itemTotal
      });
    }

    const tax = 0; // Add tax logic if needed
    const totalAmount = subtotal + tax;

    // Create request
    const request = await SellerProductRequest.create({
      sellerId: sellerId,
      sellerName: seller.businessName || seller.name,
      sellerEmail: seller.email || "",
      sellerPhone: seller.phone || "",
      items: processedItems,
      subtotal: subtotal,
      tax: tax,
      totalAmount: totalAmount,
      paymentType: paymentType,
      paymentStatus: "PENDING",
      paidAt: null,
      status: "PENDING",
      sellerNote: sellerNote || "",
      invoiceGeneratedAt: new Date()
    });

    console.log("✅ Request created:", request.requestNumber);

    let redirectUrl = null;
    let gatewayResponse = null;
    if (paymentType === "PAY_NOW") {
      try {
        const provider = getActivePaymentProvider();
        const origin = req.headers.origin || "http://localhost:5173";
        const paymentResult = await provider.initiatePayment({
          merchantOrderId: request.requestNumber,
          amountPaise: Math.round(totalAmount * 100),
          redirectUrl: `${origin}/seller/requested-orders`
        });
        redirectUrl = paymentResult.redirectUrl;
        gatewayResponse = paymentResult.gatewayResponse;
      } catch (payErr) {
        console.error("⚠️ Payment initiation error:", payErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: "Product request submitted successfully",
      data: {
        requestId: request._id,
        requestNumber: request.requestNumber,
        invoiceNumber: request.invoiceNumber,
        totalAmount: request.totalAmount,
        paymentType: request.paymentType,
        paymentStatus: request.paymentStatus,
        status: request.status,
        items: request.items,
        createdAt: request.createdAt,
        redirectUrl: redirectUrl,
        gatewayResponse: gatewayResponse,
      }
    });

  } catch (error) {
    console.error("❌ Error creating request:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create request"
    });
  }
};

// ═══════════════════════════════════════════════
// SELLER: GET MY REQUESTS HISTORY
// ═══════════════════════════════════════════════
export const getSellerRequests = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    const query = { sellerId };
    if (status) query.status = status;

    const requests = await SellerProductRequest.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await SellerProductRequest.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("❌ Error fetching requests:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch requests"
    });
  }
};

// ═══════════════════════════════════════════════
// SELLER: GET SINGLE REQUEST DETAIL
// ═══════════════════════════════════════════════
export const getSellerRequestById = async (req, res) => {
  try {
    const { requestId } = req.params;
    const sellerId = req.user.id;

    const request = await SellerProductRequest.findOne({
      _id: requestId,
      sellerId: sellerId
    }).populate("deliveryBoy").lean();

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: request
    });

  } catch (error) {
    console.error("❌ Error fetching request:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch request"
    });
  }
};

// ═══════════════════════════════════════════════
// ADMIN: GET ALL SELLER REQUESTS
// ═══════════════════════════════════════════════
export const getAllSellerRequests = async (req, res) => {
  try {
    console.log("📋 Admin fetching all seller requests...");

    const {
      status,
      sellerId,
      paymentType,
      page = 1,
      limit = 10
    } = req.query;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (sellerId) query.sellerId = sellerId;
    if (paymentType) query.paymentType = paymentType;

    const requests = await SellerProductRequest.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('deliveryBoy', 'name phone location isOnline vehicleDetails lastLocationAt image')
      .lean();

    const total = await SellerProductRequest.countDocuments(query);

    // Summary stats
    const stats = await SellerProductRequest.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" }
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      data: requests,
      stats: stats,
      pagination: {
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("❌ Error fetching all requests:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch requests"
    });
  }
};

// ═══════════════════════════════════════════════
// ADMIN: APPROVE REQUEST
// ═══════════════════════════════════════════════
import mongoose from "mongoose";

export const approveSellerRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { adminNote, startDelivery } = req.body;
    const adminId = req.user.id;

    console.log("✅ Admin approving request:", requestId);

    const request = await SellerProductRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found"
      });
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Cannot approve request with status: ${request.status}`
      });
    }

    // Update request
    request.status = "APPROVED";
    request.approvedBy = adminId;
    request.approvedAt = new Date();
    request.adminNote = adminNote || "Request approved";

    // Generate invoice number if not exists
    if (!request.invoiceNumber) {
      request.invoiceNumber = request.requestNumber.replace("REQ", "INV");
      request.invoiceGeneratedAt = new Date();
    }

    await request.save();

    // ─────────────────────────────────────────────
    // NEW: ADD PRODUCTS TO SELLER INVENTORY
    // ─────────────────────────────────────────────
    for (const item of request.items) {
      const existingInventory = await SellerInventory.findOne({
        sellerId: request.sellerId,
        productId: item.productId
      });

      if (existingInventory) {
        existingInventory.availableStock += (item.quantity || 0);
        existingInventory.totalStock += (item.quantity || 0);
        existingInventory.status = "ACTIVE";
        await existingInventory.save();
      } else {
        await SellerInventory.create({
          sellerId: request.sellerId,
          sellerName: request.sellerName,
          productId: item.productId,
          productName: item.productName,
          category: item.category,
          originalPrice: item.pricePerUnit,
          sellerPrice: item.pricePerUnit,
          availableStock: item.quantity || 0,
          totalStock: item.quantity || 0,
          soldStock: 0,
          status: "ACTIVE",
          requestId: request._id,
          requestNumber: request.requestNumber,
          paymentType: request.paymentType || "PAY_NOW"
        });
      }

      // Clone product to Seller's catalog (atomic upsert to prevent race conditions)
      const adminProduct = await Product.findById(item.productId);
      if (adminProduct) {
        // Prevent "clone of clone" bug. Trace back to original master product ID
        const actualMasterId = adminProduct.adminProductId || adminProduct._id;
        const quantity = item.quantity || 0;

        // Resolve the true master product for cloning properties
        let baseProduct = adminProduct;
        if (adminProduct.adminProductId) {
          const masterProduct = await Product.findById(adminProduct.adminProductId);
          if (masterProduct) {
            baseProduct = masterProduct;
          }
        }

        const uniqueSuffix = `-${request.sellerId.toString().slice(-6)}-${Date.now().toString().slice(-4)}`;
        const baseObj = baseProduct.toObject();
        delete baseObj._id;
        delete baseObj.__v;
        delete baseObj.sellerId;
        delete baseObj.adminProductId;
        delete baseObj.stock;
        delete baseObj.slug;
        delete baseObj.sku;
        delete baseObj.createdAt;
        delete baseObj.updatedAt;

        // Atomic upsert: if product exists for this seller+master, increment stock.
        // If it doesn't exist, create it with all base product properties.
        await Product.findOneAndUpdate(
          { adminProductId: actualMasterId, sellerId: request.sellerId },
          {
            $inc: { stock: quantity },
            $setOnInsert: {
              ...baseObj,
              sellerId: request.sellerId,
              adminProductId: actualMasterId,
              slug: `${baseProduct.slug}${uniqueSuffix}`,
              sku: `${baseProduct.sku || 'SKU'}${uniqueSuffix}`,
              lastSubmittedByRole: "admin",
              approvalStatus: "approved",
              approvalNote: "Automatically approved from admin warehouse delivery.",
            },
          },
          { upsert: true, new: true }
        );
      }
    }

    // ─────────────────────────────────────────────
    // NEW: START DELIVERY MODE (IF REQUESTED)
    // ─────────────────────────────────────────────
    const { deliveryMode, deliveryBoyId } = req.body;

    if (deliveryMode === "SHIPROCKET") {
      request.deliveryType = "SHIPROCKET";
      request.deliveryWorkflowStatus = "DELIVERY_ASSIGNED";
      request.shipRocketDetails = {
        orderId: `PENDING_SR_${request._id}`,
        trackingNumber: "Assigning...",
        status: "PENDING",
      };
      await request.save();

      const sellerObj = await Seller.findById(request.sellerId).lean();

      try {
        await createShipRocketOrderForRequest(request, sellerObj || {}, request.items);
        console.log("🚀 Direct Shiprocket order created for request upon approval:", request.requestNumber);
      } catch (srErr) {
        console.error("❌ Direct Shiprocket creation failed upon approval:", srErr.message);
      }
      console.log("🚚 Shiprocket delivery processing finished for request:", request.requestNumber);
    } else if (deliveryMode === "MANUAL" && deliveryBoyId) {
      request.deliveryType = "STANDARD";
      request.deliveryBoy = deliveryBoyId;
      request.deliveryWorkflowStatus = "DELIVERY_ASSIGNED";
      request.assignedAt = new Date();
      await request.save();
    } else if (startDelivery || deliveryMode === "BROADCAST") {
      request.deliveryType = "STANDARD";
      await request.save();
      await startRequestDeliverySearch(request._id);
      console.log("🚚 Delivery broadcast initiated for request:", request.requestNumber);
    }

    console.log("✅ Request approved:", request.requestNumber);

    return res.status(200).json({
      success: true,
      message: deliveryMode === "SHIPROCKET"
        ? "Request approved and Shiprocket delivery queued successfully!"
        : "Request approved successfully",
      data: request
    });

  } catch (error) {
    console.error("❌ Error approving request:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to approve request: " + error.message,
      error: error.stack
    });
  }
};

// ═══════════════════════════════════════════════
// ADMIN: REJECT REQUEST
// ═══════════════════════════════════════════════
export const rejectSellerRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { rejectedReason } = req.body;
    const adminId = req.user.id;

    console.log("❌ Admin rejecting request:", requestId);

    const request = await SellerProductRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found"
      });
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Cannot reject request with status: ${request.status}`
      });
    }

    request.status = "REJECTED";
    request.rejectedReason = rejectedReason || "Request rejected by admin";
    request.approvedBy = adminId;
    request.approvedAt = new Date();

    await request.save();

    console.log("✅ Request rejected:", request.requestNumber);

    return res.status(200).json({
      success: true,
      message: "Request rejected",
      data: request
    });

  } catch (error) {
    console.error("❌ Error rejecting request:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reject request"
    });
  }
};



// ═══════════════════════════════════════════
// ADMIN: TRIGGER DELIVERY BROADCAST (FOR ALREADY APPROVED)
// ═══════════════════════════════════════════
export const triggerDeliveryBroadcast = async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await SellerProductRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    if (request.status === "PENDING") {
      request.status = "APPROVED";
      request.approvedAt = new Date();
      if (!request.invoiceNumber) {
        request.invoiceNumber = request.requestNumber.replace("REQ", "INV");
        request.invoiceGeneratedAt = new Date();
      }
    } else if (request.status !== "APPROVED") {
      return res.status(400).json({ success: false, message: `Cannot dispatch request with status: ${request.status}` });
    }

    if (request.deliveryBoy) {
      return res.status(400).json({ success: false, message: "Delivery boy is already assigned" });
    }

    const hasActiveShiprocketInTransit =
      request.deliveryType === "SHIPROCKET" &&
      request.shipRocketDetails?.trackingNumber &&
      request.shipRocketDetails?.trackingNumber !== "Assigning..." &&
      !["SHIPMENT_FAILED", "CANCELLED", "PENDING", "NEW", "UNASSIGNED"].includes(request.shipRocketDetails?.status);

    if (hasActiveShiprocketInTransit) {
      return res.status(400).json({ success: false, message: "Request is assigned to an active Shiprocket delivery in transit." });
    }

    // Switch/ensure deliveryType is STANDARD for local driver broadcast
    request.deliveryType = "STANDARD";
    request.deliveryWorkflowStatus = "DELIVERY_SEARCH";
    await request.save();

    await startRequestDeliverySearch(request._id);
    console.log("🚚 Delivery broadcast initiated for request:", request.requestNumber);

    return res.status(200).json({
      success: true,
      message: "Delivery broadcast started successfully",
      request
    });
  } catch (error) {
    console.error("❌ Error triggering delivery broadcast:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to trigger delivery broadcast"
    });
  }
};

// ═══════════════════════════════════════════
// ADMIN: MANUAL ASSIGN DELIVERY (FOR ALREADY APPROVED)
// ═══════════════════════════════════════════
export const manualAssignDelivery = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { deliveryBoyId } = req.body;

    if (!deliveryBoyId) {
      return res.status(400).json({ success: false, message: "deliveryBoyId is required" });
    }

    const request = await SellerProductRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    if (request.status === "PENDING") {
      request.status = "APPROVED";
      request.approvedAt = new Date();
      if (!request.invoiceNumber) {
        request.invoiceNumber = request.requestNumber.replace("REQ", "INV");
        request.invoiceGeneratedAt = new Date();
      }
    } else if (request.status !== "APPROVED") {
      return res.status(400).json({ success: false, message: `Cannot dispatch request with status: ${request.status}` });
    }

    const hasActiveShiprocketInTransit =
      request.deliveryType === "SHIPROCKET" &&
      request.shipRocketDetails?.trackingNumber &&
      request.shipRocketDetails?.trackingNumber !== "Assigning..." &&
      !["SHIPMENT_FAILED", "CANCELLED", "PENDING", "NEW", "UNASSIGNED"].includes(request.shipRocketDetails?.status);

    if (hasActiveShiprocketInTransit) {
      return res.status(400).json({ success: false, message: "Request is assigned to an active Shiprocket delivery in transit." });
    }

    request.deliveryType = "STANDARD";
    request.deliveryBoy = deliveryBoyId;
    request.deliveryWorkflowStatus = "DELIVERY_ASSIGNED";
    request.assignedAt = new Date();
    await request.save();

    console.log("🚚 Delivery boy manually assigned for request:", request.requestNumber);

    try {

      const payload = {
        orderId: request.requestNumber,
        sourceType: "SELLER_REQUEST",
        workflowStatus: "DELIVERY_ASSIGNED",
        preview: {
          pickup: "Veenolex Wholesale Warehouse",
          drop: request.sellerName || "Seller Store",
          total: request.totalAmount || 0,
        }
      };

      emitToDelivery(deliveryBoyId, { event: "delivery:assigned", payload });

      const deliveryPartner = await Delivery.findById(deliveryBoyId).select("fcmToken").lean();
      
      if (deliveryPartner?.fcmToken) {
        emitNotificationEvent(NOTIFICATION_EVENTS.BULK_PUSH, {
          messages: [{
            token: deliveryPartner.fcmToken,
            notification: {
              title: "New Delivery Assigned",
              body: `You have been manually assigned to pickup from Veenolex Wholesale Warehouse`,
            },
            data: {
              event: "delivery:assigned",
              payload: JSON.stringify(payload),
            }
          }]
        });
      }

      const notificationDoc = await Notification.create({
        recipient: deliveryBoyId,
        userId: deliveryBoyId,
        recipientModel: "Delivery",
        role: "delivery",
        title: "Delivery Assigned",
        message: `You have been manually assigned to deliver ${request.requestNumber}`,
        body: `You have been manually assigned to deliver ${request.requestNumber}`,
        type: "order",
        channel: "in_app",
        provider: "internal",
        status: "sent",
        sentAt: new Date(),
        data: { orderId: request.requestNumber, sourceType: "SELLER_REQUEST" },
      });
      
      // Wake up the delivery app to show the alert and play sound
      emitToDelivery(deliveryBoyId, {
        event: "notification:new",
        payload: {
          notificationId: notificationDoc._id.toString(),
          eventType: "DELIVERY_ASSIGNED",
          role: "delivery",
          title: "Delivery Assigned",
          body: notificationDoc.body,
          data: notificationDoc.data,
          createdAt: notificationDoc.createdAt.toISOString()
        }
      });
      
    } catch (err) {
      console.warn("❌ Failed to notify delivery boy on manual assign", err.message);
    }


    return res.status(200).json({
      success: true,
      message: "Delivery boy manually assigned",
      request
    });
  } catch (error) {
    console.error("❌ Error manually assigning delivery:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to assign delivery boy manually"
    });
  }
};

// ═══════════════════════════════════════════
// ADMIN: ASSIGN SHIPROCKET DELIVERY (FOR ALREADY APPROVED)
// ═══════════════════════════════════════════
export const assignShiprocketDelivery = async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await SellerProductRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    if (request.status === "PENDING") {
      request.status = "APPROVED";
      request.approvedAt = new Date();
      if (!request.invoiceNumber) {
        request.invoiceNumber = request.requestNumber.replace("REQ", "INV");
        request.invoiceGeneratedAt = new Date();
      }
    } else if (request.status !== "APPROVED") {
      return res.status(400).json({ success: false, message: `Cannot dispatch request with status: ${request.status}` });
    }

    if (request.deliveryBoy) {
      return res.status(400).json({ success: false, message: "A delivery partner is already assigned" });
    }

    // Populate seller info so we have address details for Shiprocket mapping
    const seller = await Seller.findById(request.sellerId);
    if (!seller) {
      return res.status(404).json({ success: false, message: "Seller not found" });
    }

    // Update request state to "Shipment Pending" immediately
    request.deliveryType = "SHIPROCKET";
    request.deliveryWorkflowStatus = "DELIVERY_ASSIGNED";
    request.shipRocketDetails = {
      orderId: `PENDING_SR_${request._id}`,
      trackingNumber: "Assigning...",
      status: "PENDING",
    };
    await request.save();

    try {
      const shipDetails = await createShipRocketOrderForRequest(request, seller, request.items);
      console.log("🚀 Direct Shiprocket order created for request:", request.requestNumber, shipDetails);

      return res.status(200).json({
        success: true,
        message: "Shiprocket delivery order created successfully",
        request,
        shipRocketDetails: request.shipRocketDetails
      });
    } catch (srErr) {
      console.error("❌ Direct Shiprocket creation failed:", srErr.message);
      return res.status(400).json({
        success: false,
        message: srErr.message || "Failed to create Shiprocket order",
        request,
        shipRocketDetails: request.shipRocketDetails
      });
    }
  } catch (error) {
    console.error("❌ Error assigning Shiprocket delivery:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to assign Shiprocket delivery",
      error: error.message
    });
  }
};

/* ===============================
   TRIGGER BROADCAST DELIVERY FOR REQUEST
================================ */
export const broadcastRequestDeliveryController = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await SellerProductRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: "Requested order not found" });
    }

    await startRequestDeliverySearch(requestId);

    return res.status(200).json({
      success: true,
      message: "Delivery search broadcast triggered successfully",
      request,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ===============================
   MANUALLY ASSIGN DELIVERY BOY FOR REQUEST
================================ */
export const assignRequestDeliveryBoyController = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { deliveryBoyId } = req.body;

    if (!deliveryBoyId) {
      return res.status(400).json({ success: false, message: "deliveryBoyId is required" });
    }

    const request = await SellerProductRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: "Requested order not found" });
    }

    const deliveryPartner = await Delivery.findById(deliveryBoyId);
    if (!deliveryPartner) {
      return res.status(404).json({ success: false, message: "Delivery partner not found" });
    }

    request.deliveryBoy = deliveryBoyId;
    request.deliveryWorkflowStatus = "DELIVERY_ASSIGNED";
    await request.save();

    emitToDelivery("delivery:assigned", {
      orderId: request.requestNumber,
      sourceType: "SELLER_REQUEST",
      request,
    });

    return res.status(200).json({
      success: true,
      message: "Delivery partner assigned successfully",
      request,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
