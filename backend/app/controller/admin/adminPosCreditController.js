/**
 * adminPosCreditController.js — Admin POS Credit/Udhaar endpoints.
 *
 * Handles credit customers list, transaction history, manual credit adjustments,
 * cash payment recording, and PhonePe credit repayment sessions.
 */

import User from "../../models/customer.js";
import CreditTransaction from "../../models/creditTransaction.js";
import { initiatePOSCreditPhonePeRepayment, verifyPOSCreditPhonePeRepayment } from "../../services/pos/posPhonepeService.js";

/**
 * GET /admin/pos/credit/customers — Fetch customers with credit balances or transactions.
 */
export async function getCreditCustomers(req, res) {
  try {
    const { search = "", hasDebtOnly = "false" } = req.query;

    const query = { role: "user" };

    if (hasDebtOnly === "true") {
      query.creditBalance = { $gt: 0 };
    }

    if (search.trim()) {
      const term = search.trim();
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      query.$or = [
        { name: regex },
        { phone: regex },
        { email: regex }
      ];
    }

    const customers = await User.find(query)
      .select("name phone email creditBalance walletBalance isActive")
      .sort({ creditBalance: -1, name: 1 })
      .lean();

    return res.json({
      success: true,
      customers
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * GET /admin/pos/credit/history/:customerId — Fetch credit transaction history for a customer.
 */
export async function getCreditHistory(req, res) {
  try {
    const { customerId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const [transactions, total] = await Promise.all([
      CreditTransaction.find({ customer: customerId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("order", "orderId pricing")
        .lean(),
      CreditTransaction.countDocuments({ customer: customerId })
    ]);

    const customer = await User.findById(customerId).select("name phone email creditBalance").lean();

    return res.json({
      success: true,
      customer,
      transactions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * POST /admin/pos/credit/add — Manually add/debit credit balance for a customer.
 */
export async function addCredit(req, res) {
  try {
    const { customerId, amount, note } = req.body;

    const creditAmount = Number(amount);
    if (isNaN(creditAmount) || creditAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid credit amount"
      });
    }

    const customer = await User.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    customer.creditBalance = (customer.creditBalance || 0) + creditAmount;
    await customer.save();

    const transaction = await CreditTransaction.create({
      customer: customer._id,
      type: "Adjustment",
      amount: creditAmount,
      balanceAfter: customer.creditBalance,
      note: note || "Manual Credit Addition",
      createdBy: req.user?._id,
      createdByRole: "Admin"
    });

    return res.json({
      success: true,
      message: "Credit added successfully",
      creditBalance: customer.creditBalance,
      transaction
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * POST /admin/pos/credit/payment — Record a cash/offline payment against credit balance.
 */
export async function recordCreditPayment(req, res) {
  try {
    const { customerId, amount, note, paymentMethod = "Cash" } = req.body;

    const paymentAmount = Number(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount"
      });
    }

    const customer = await User.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    // Deduct from credit balance (Udhaar)
    customer.creditBalance = (customer.creditBalance || 0) - paymentAmount;
    await customer.save();

    const transaction = await CreditTransaction.create({
      customer: customer._id,
      type: "Payment",
      amount: -paymentAmount, // Negative amount in ledger signifies payment/reduction of debt
      balanceAfter: customer.creditBalance,
      paymentMethod,
      note: note || `Received payment via ${paymentMethod}`,
      createdBy: req.user?._id,
      createdByRole: "Admin"
    });

    return res.json({
      success: true,
      message: "Payment recorded successfully",
      creditBalance: customer.creditBalance,
      transaction
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * POST /admin/pos/credit/payment/initiate — Initiate PhonePe online credit repayment session.
 */
export async function initiateAdminCreditPhonePeRepayment(req, res) {
  try {
    const { customerId, amount, redirectUrl } = req.body;

    const repayment = await initiatePOSCreditPhonePeRepayment({
      customerId,
      amount,
      redirectUrl,
      sellerId: null
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
 * POST /admin/pos/credit/payment/verify — Verify PhonePe online credit repayment and adjust balance.
 */
export async function verifyAdminCreditPhonePeRepayment(req, res) {
  try {
    const { merchantOrderId } = req.body;

    if (!merchantOrderId) {
      return res.status(400).json({
        success: false,
        message: "merchantOrderId is required"
      });
    }

    const verification = await verifyPOSCreditPhonePeRepayment({
      merchantOrderId,
      createdById: req.user?._id,
      createdByRole: "Admin"
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
