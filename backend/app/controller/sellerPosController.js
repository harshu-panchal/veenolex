/**
 * sellerPosController.js — Seller-scoped POS endpoints.
 *
 * Handles order creation, multi-bill state sync, customizable bill settings,
 * seller-scoped customer management, and seller-owned categories/subcategories.
 */

import mongoose from "mongoose";
import Order from "../models/order.js";
import User from "../models/customer.js";
import Seller from "../models/seller.js";
import SellerPOSState from "../models/sellerPOSState.js";
import SellerOwnedCategory from "../models/sellerOwnedCategory.js";
import SellerOwnedSubCategory from "../models/sellerOwnedSubCategory.js";
import CreditTransaction from "../models/creditTransaction.js";
import SupplierLedger from "../models/supplierLedger.js";
import SupplierTransaction from "../models/supplierTransaction.js";
import GSTReportEntry from "../models/gstReportEntry.js";
import SellerPurchaseEntry from "../models/sellerPurchaseEntry.js";
import { createPOSOrder, deletePOSOrder, updatePOSOrderItems } from "../services/pos/posOrderService.js";
import { getPOSProducts, findProductByBarcode } from "../services/pos/posProductService.js";
import {
  initiatePOSPhonePePayment,
  verifyPOSPhonePePayment,
  initiatePOSCreditPhonePeRepayment,
  verifyPOSCreditPhonePeRepayment
} from "../services/pos/posPhonepeService.js";

/**
 * POST /seller/pos/orders — Create a seller POS order.
 */
export async function createSellerPOSOrder(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const sellerId = req.user.id;
    const { customerId, paymentMethod, paymentStatus, items } = req.body;

    const order = await createPOSOrder({
      customerId: customerId || "walk-in-customer",
      paymentMethod: paymentMethod || "Cash",
      paymentStatus: paymentStatus || "Paid",
      items,
      adminNotes: `POS Order - Seller: ${sellerId}`,
      sellerId,
      createdByRole: "Seller",
      createdById: req.user.id,
    });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "POS order created successfully",
      order,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * GET /seller/pos/state — Fetch multi-bill UI state.
 */
export async function getSellerPOSState(req, res) {
  try {
    const sellerId = req.user.id;
    let state = await SellerPOSState.findOne({ seller: sellerId }).lean();
    if (!state) {
      state = await SellerPOSState.create({
        seller: sellerId,
        bills: [],
        activeBillIndex: 0,
      });
    }
    return res.json({ success: true, state });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * PUT /seller/pos/state — Sync/save multi-bill UI state.
 */
export async function updateSellerPOSState(req, res) {
  try {
    const sellerId = req.user.id;
    const { bills, activeBillIndex } = req.body;

    const state = await SellerPOSState.findOneAndUpdate(
      { seller: sellerId },
      { bills, activeBillIndex, updatedAt: new Date() },
      { new: true, upsert: true }
    );

    return res.json({ success: true, state });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /seller/pos/bill-settings — Fetch bill headers/footers settings.
 */
export async function getSellerPOSBillSettings(req, res) {
  try {
    const sellerId = req.user.id;
    const seller = await Seller.findById(sellerId).select("billSettings").lean();
    if (!seller) {
      return res.status(404).json({ success: false, message: "Seller not found" });
    }
    return res.json({ success: true, billSettings: seller.billSettings || {} });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * PUT /seller/pos/bill-settings — Update bill headers/footers settings.
 */
export async function updateSellerPOSBillSettings(req, res) {
  try {
    const sellerId = req.user.id;
    const { billSettings } = req.body;

    const seller = await Seller.findByIdAndUpdate(
      sellerId,
      { billSettings },
      { new: true }
    ).select("billSettings");

    return res.json({ success: true, billSettings: seller.billSettings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /seller/pos/customers — Fetch seller-scoped customers + general customers.
 */
export async function getSellerPOSCustomers(req, res) {
  try {
    const sellerId = req.user.id;
    const { search = "" } = req.query;

    const query = {
      role: "user",
      $or: [{ sellerId: sellerId }, { sellerId: null }],
    };

    if (search.trim()) {
      const term = search.trim();
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      query.$and = [
        {
          $or: [{ sellerId: sellerId }, { sellerId: null }],
        },
        {
          $or: [{ name: regex }, { phone: regex }, { email: regex }],
        },
      ];
      delete query.$or;
    }

    const customers = await User.find(query)
      .select("name phone email creditBalance walletBalance isActive sellerId")
      .sort({ name: 1 })
      .lean();

    return res.json({ success: true, customers });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /seller/pos/customers — Create a seller-scoped customer.
 */
export async function createSellerPOSCustomer(req, res) {
  try {
    const sellerId = req.user.id;
    const { name, phone, email } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Customer name is required" });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: "Customer phone is required" });
    }

    // Check if phone already registered globally or under this seller
    const existing = await User.findOne({ phone: phone.trim(), sellerId });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Customer with this phone number already registered under your account",
      });
    }

    const customer = await User.create({
      name: name.trim(),
      phone: phone.trim(),
      email: email || `${phone.trim()}@seller-pos.com`,
      role: "user",
      isVerified: true,
      isActive: true,
      sellerId,
    });

    return res.status(201).json({ success: true, customer });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /seller/pos/products — Catalog product search.
 */
export async function getSellerPOSProducts(req, res) {
  try {
    const { search, limit } = req.query;
    // Seller POS catalog is currently universal, but could be filtered by sellerId if needed.
    const products = await getPOSProducts({
      search: search || "",
      limit: Number(limit) || 50,
    });
    return res.json({ success: true, products });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /seller/orders/pos-report — List of seller POS invoices.
 */
export async function getSellerPOSInvoiceReport(req, res) {
  try {
    const sellerId = req.user.id;
    const { startDate, endDate, page = 1, limit = 50 } = req.query;

    const filter = {
      seller: new mongoose.Types.ObjectId(sellerId),
      adminNotes: { $regex: new RegExp(`POS Order - Seller: ${sellerId}`, "i") },
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
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /seller/pos/own-categories — List seller-owned POS categories.
 */
export async function getSellerOwnedCategories(req, res) {
  try {
    const sellerId = req.user.id;
    const categories = await SellerOwnedCategory.find({ seller: sellerId }).sort({ name: 1 }).lean();
    return res.json({ success: true, categories });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /seller/pos/own-categories — Create seller-owned POS category.
 */
export async function createSellerOwnedCategory(req, res) {
  try {
    const sellerId = req.user.id;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }

    // Verify permission
    const seller = await Seller.findById(sellerId).select("canCreateCategories").lean();
    if (!seller?.canCreateCategories) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to create categories",
      });
    }

    const category = await SellerOwnedCategory.create({
      name: name.trim(),
      seller: sellerId,
    });

    return res.status(201).json({ success: true, category });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * DELETE /seller/pos/own-categories/:id — Delete seller-owned POS category.
 */
export async function deleteSellerOwnedCategory(req, res) {
  try {
    const sellerId = req.user.id;
    const { id } = req.params;

    const category = await SellerOwnedCategory.findOneAndDelete({ _id: id, seller: sellerId });
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found or unauthorized" });
    }

    // Cascade delete subcategories
    await SellerOwnedSubCategory.deleteMany({ category: id, seller: sellerId });

    return res.json({ success: true, message: "Category and subcategories deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /seller/pos/own-subcategories — List subcategories under category.
 */
export async function getSellerOwnedSubCategories(req, res) {
  try {
    const sellerId = req.user.id;
    const { categoryId } = req.query;

    const query = { seller: sellerId };
    if (categoryId) query.category = categoryId;

    const subcategories = await SellerOwnedSubCategory.find(query).sort({ name: 1 }).lean();
    return res.json({ success: true, subcategories });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /seller/pos/own-subcategories — Create seller-owned POS subcategory.
 */
export async function createSellerOwnedSubCategory(req, res) {
  try {
    const sellerId = req.user.id;
    const { name, categoryId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Subcategory name is required" });
    }
    if (!categoryId) {
      return res.status(400).json({ success: false, message: "Category ID is required" });
    }

    const subcategory = await SellerOwnedSubCategory.create({
      name: name.trim(),
      category: categoryId,
      seller: sellerId,
    });

    return res.status(201).json({ success: true, subcategory });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /seller/pos/credit/payment/initiate — Initiate PhonePe online credit repayment session for seller customer.
 */
export async function initiateSellerCreditPhonePeRepayment(req, res) {
  try {
    const sellerId = req.user.id;
    const { customerId, amount, redirectUrl } = req.body;

    const repayment = await initiatePOSCreditPhonePeRepayment({
      customerId,
      amount,
      redirectUrl,
      sellerId
    });

    return res.status(201).json({
      success: true,
      message: "Online credit repayment initiated",
      redirectUrl: repayment.redirectUrl,
      merchantOrderId: repayment.merchantOrderId
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * POST /seller/pos/credit/payment/verify — Verify PhonePe online credit repayment and adjust balance for seller customer.
 */
export async function verifySellerCreditPhonePeRepayment(req, res) {
  try {
    const sellerId = req.user.id;
    const { merchantOrderId } = req.body;

    if (!merchantOrderId) {
      return res.status(400).json({
        success: false,
        message: "merchantOrderId is required"
      });
    }

    const verification = await verifyPOSCreditPhonePeRepayment({
      merchantOrderId,
      createdById: sellerId,
      createdByRole: "Seller"
    });

    return res.json({
      success: verification.success,
      message: verification.success ? "Credit payment verified and credited" : "Credit payment pending/failed",
      creditBalance: verification.creditBalance,
      transaction: verification.transaction
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
