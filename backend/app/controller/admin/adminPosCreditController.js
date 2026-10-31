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
      .select("name phone email creditBalance walletBalance isActive location addresses")
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
 * POST /admin/pos/customers — Create or register a customer from POS with optional address.
 */
export async function createAdminPOSCustomer(req, res) {
  try {
    const { name, phone, address, email } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Customer name is required" });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: "Customer phone is required" });
    }

    const cleanPhone = phone.trim();
    const cleanName = name.trim();
    const cleanAddress = (address || "").trim();

    // Check if customer with this phone number already exists
    let customer = await User.findOne({ phone: cleanPhone, role: "user" });
    if (customer) {
      if (cleanAddress && !customer.location?.address) {
        customer.location = {
          ...customer.location,
          address: cleanAddress,
          updatedAt: new Date(),
        };
        customer.addresses = customer.addresses || [];
        if (!customer.addresses.length) {
          customer.addresses.push({
            label: "home",
            fullAddress: cleanAddress,
            formattedAddress: cleanAddress,
          });
        }
        await customer.save();
      }
      return res.status(200).json({
        success: true,
        message: "Customer already exists and selected",
        customer,
        user: customer,
      });
    }

    // Create new customer
    const userPayload = {
      name: cleanName,
      phone: cleanPhone,
      email: email ? email.trim() : `${cleanPhone}@pos-customer.com`,
      role: "user",
      isVerified: true,
      isActive: true,
    };

    if (cleanAddress) {
      userPayload.location = {
        address: cleanAddress,
        city: "",
        state: "",
        pincode: "",
        updatedAt: new Date(),
      };
      userPayload.addresses = [
        {
          label: "home",
          fullAddress: cleanAddress,
          formattedAddress: cleanAddress,
        },
      ];
    }

    customer = await User.create(userPayload);

    return res.status(201).json({
      success: true,
      message: "Customer registered successfully",
      customer,
      user: customer,
    });
  } catch (error) {
    console.error("Error creating POS customer:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create customer",
    });
  }
}

/**
 * PUT /admin/pos/customers/:id — Update customer phone, address, and name.
 */
export async function updateAdminPOSCustomer(req, res) {
  try {
    const { id } = req.params;
    const { name, phone, address } = req.body;

    if (!id || id === "walk-in-customer") {
      return res.status(400).json({ success: false, message: "Invalid customer ID" });
    }

    const customer = await User.findById(id);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    if (name && name.trim()) {
      customer.name = name.trim();
    }

    if (phone && phone.trim()) {
      const cleanPhone = phone.trim();
      if (cleanPhone !== customer.phone) {
        const existing = await User.findOne({ phone: cleanPhone, _id: { $ne: customer._id } });
        if (existing) {
          return res.status(400).json({ success: false, message: "Another customer already has this phone number" });
        }
        customer.phone = cleanPhone;
      }
    }

    if (address !== undefined) {
      const cleanAddress = (address || "").trim();
      customer.location = {
        ...(customer.location || {}),
        address: cleanAddress,
        updatedAt: new Date(),
      };

      customer.addresses = customer.addresses || [];
      if (customer.addresses.length > 0) {
        customer.addresses[0].fullAddress = cleanAddress;
        customer.addresses[0].formattedAddress = cleanAddress;
      } else if (cleanAddress) {
        customer.addresses.push({
          label: "home",
          fullAddress: cleanAddress,
          formattedAddress: cleanAddress,
        });
      }
    }

    await customer.save();

    return res.json({
      success: true,
      message: "Customer updated successfully",
      customer,
      user: customer,
    });
  } catch (error) {
    console.error("Error updating POS customer:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update customer",
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
