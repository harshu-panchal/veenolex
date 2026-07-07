/**
 * adminPosOrderController.js — Admin POS order endpoints.
 *
 * Handles: create POS sale, create online POS sale, verify PhonePe,
 * edit items, exchange, delete, POS report, invoice report.
 */

import Order from "../../models/order.js";
import { createPOSOrder, deletePOSOrder, updatePOSOrderItems } from "../../services/pos/posOrderService.js";
import { getPOSProducts, findProductByBarcode } from "../../services/pos/posProductService.js";
import { initiatePOSPhonePePayment, verifyPOSPhonePePayment } from "../../services/pos/posPhonepeService.js";

/**
 * POST /admin/orders/pos — Create a cash/credit POS sale.
 */
export async function createAdminPOSOrder(req, res) {
  try {
    const { customerId, paymentMethod, paymentStatus, items } = req.body;

    const order = await createPOSOrder({
      customerId: customerId || "walk-in-customer",
      paymentMethod: paymentMethod || "Cash",
      paymentStatus: paymentStatus || "Paid",
      items,
      adminNotes: "Created via POS System",
      sellerId: null,
      createdByRole: "Admin",
      createdById: req.user?._id,
    });

    return res.status(201).json({
      success: true,
      message: "POS order created successfully",
      order,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * PATCH /admin/orders/:id/items — Edit items on a delivered POS order.
 */
export async function updateAdminPOSOrderItems(req, res) {
  try {
    const { id } = req.params;
    const { items } = req.body;

    const order = await updatePOSOrderItems(id, items, null);

    return res.json({
      success: true,
      message: "Order items updated successfully",
      order,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * POST /admin/pos/exchange — Exchange items (return old, sell new).
 *
 * Creates a new POS order for the net difference, with adminNotes
 * marking it as an exchange.
 */
export async function exchangeAdminPOSItems(req, res) {
  try {
    const {
      originalOrderId,
      returnItems,
      newItems,
      customerId,
      paymentMethod,
    } = req.body;

    // Validate original order exists and is POS
    const originalOrder = await Order.findById(originalOrderId);
    if (!originalOrder || !originalOrder.adminNotes?.includes("POS")) {
      return res.status(404).json({
        success: false,
        message: "Original POS order not found",
      });
    }

    // Restore stock for returned items
    const { incrementVariantStock } = await import(
      "../../services/pos/variantStockService.js"
    );
    const { isValidObjectId } = await import(
      "../../services/pos/variantHelpers.js"
    );

    for (const item of returnItems || []) {
      if (item.productId && isValidObjectId(item.productId)) {
        await incrementVariantStock({
          productId: item.productId,
          variantId: item.variationId || null,
          quantity: Number(item.quantity || 1),
          source: "ORDER_EDIT_RESTORE",
          orderId: originalOrder._id,
          note: `Exchange return from ${originalOrder.orderId}`,
        });
      }
    }

    // Create new order for the new items
    const order = await createPOSOrder({
      customerId: customerId || "walk-in-customer",
      paymentMethod: paymentMethod || "Cash",
      paymentStatus: "Paid",
      items: newItems,
      adminNotes: `POS Exchange from ${originalOrder.orderId}`,
      sellerId: null,
      createdByRole: "Admin",
      createdById: req.user?._id,
    });

    return res.status(201).json({
      success: true,
      message: "Exchange completed successfully",
      order,
      originalOrderId: originalOrder.orderId,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * DELETE /admin/orders/pos/:id — Delete a POS order (walk-in only).
 */
export async function deleteAdminPOSOrder(req, res) {
  try {
    const { id } = req.params;
    const order = await deletePOSOrder(id);

    return res.json({
      success: true,
      message: "POS order deleted successfully",
      orderId: order.orderId,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * GET /admin/products/pos — POS catalog product search.
 */
export async function getAdminPOSProducts(req, res) {
  try {
    const { search, limit } = req.query;
    const products = await getPOSProducts({
      search: search || "",
      limit: Number(limit) || 50,
    });

    return res.json({ success: true, products });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * GET /admin/products/pos/barcode — Find product by barcode scan.
 */
export async function getAdminPOSProductByBarcode(req, res) {
  try {
    const { code } = req.query;
    const product = await findProductByBarcode(code);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "No product found for this barcode",
      });
    }

    return res.json({ success: true, product });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * GET /admin/pos/report — POS sales summary report.
 *
 * Query params: startDate, endDate, page, limit
 */
export async function getAdminPOSReport(req, res) {
  try {
    const {
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {
      adminNotes: { $regex: /POS/i },
    };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("customer", "name phone email")
        .lean(),
      Order.countDocuments(filter),
    ]);

    // Compute summary
    const summary = orders.reduce(
      (acc, order) => {
        const total = order.pricing?.total || order.paymentBreakdown?.grandTotal || 0;
        const tax = order.pricing?.gst || order.paymentBreakdown?.taxTotal || 0;
        acc.totalSales += total;
        acc.totalTax += tax;
        acc.orderCount += 1;
        return acc;
      },
      { totalSales: 0, totalTax: 0, orderCount: 0 }
    );

    return res.json({
      success: true,
      orders,
      summary,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * GET /admin/orders/pos-report — Paginated POS invoice list for reports.
 */
export async function getAdminPOSInvoiceReport(req, res) {
  try {
    const {
      startDate,
      endDate,
      paymentMethod,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {
      adminNotes: { $regex: /POS/i },
    };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    if (paymentMethod) {
      filter.posPaymentMethod = paymentMethod;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select("orderId items pricing paymentBreakdown posPaymentMethod customerName customerPhone createdAt adminNotes")
        .lean(),
      Order.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * POST /admin/orders/pos/online — Create a pending POS sale and initiate PhonePe payment.
 */
export async function createAdminPOSOnlineOrder(req, res) {
  try {
    const { customerId, items, redirectUrl } = req.body;

    if (!redirectUrl) {
      return res.status(400).json({
        success: false,
        message: "redirectUrl is required for online checkout"
      });
    }

    // Create the POS order shell in pending (CREATED) payment status
    const order = await createPOSOrder({
      customerId: customerId || "walk-in-customer",
      paymentMethod: "Online",
      paymentStatus: "Pending",
      items,
      adminNotes: "Created via POS System (Online Payment)",
      sellerId: null,
      createdByRole: "Admin",
      createdById: req.user?._id,
    });

    // Initiate payment with PhonePe adapter
    const payment = await initiatePOSPhonePePayment(order._id, redirectUrl);

    return res.status(201).json({
      success: true,
      message: "POS Online payment initiated",
      order,
      redirectUrl: payment.redirectUrl,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * POST /admin/orders/pos/verify — Verify POS order payment status on PhonePe.
 */
export async function verifyAdminPOSPayment(req, res) {
  try {
    const { orderId } = req.body; // Pass the public orderId (ORD-XXXX)

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "orderId is required"
      });
    }

    const verification = await verifyPOSPhonePePayment(orderId);

    return res.json({
      success: verification.success,
      message: verification.success ? "Payment verified successfully" : "Payment verification failed/pending",
      order: verification.order
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
