/**
 * adminPosSupplierController.js — Admin POS Supplier Ledger endpoints.
 *
 * Handles supplier CRUD, tracking purchases on credit (debt), and recording
 * payments to suppliers.
 */

import SupplierLedger from "../../models/supplierLedger.js";
import SupplierTransaction from "../../models/supplierTransaction.js";

/**
 * GET /admin/pos/suppliers — Fetch suppliers.
 */
export async function getSuppliers(req, res) {
  try {
    const { search = "" } = req.query;

    const query = { seller: null }; // Admin suppliers only

    if (search.trim()) {
      const term = search.trim();
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      query.$or = [
        { name: regex },
        { phone: regex },
        { email: regex },
        { gstin: regex }
      ];
    }

    const suppliers = await SupplierLedger.find(query).sort({ name: 1 }).lean();

    return res.json({
      success: true,
      suppliers
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * GET /admin/pos/suppliers/:id — Get details of a single supplier + transactions.
 */
export async function getSupplierById(req, res) {
  try {
    const { id } = req.params;

    const supplier = await SupplierLedger.findById(id).lean();
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found"
      });
    }

    const transactions = await SupplierTransaction.find({ supplier: id })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      supplier,
      transactions
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * POST /admin/pos/suppliers — Create a new supplier.
 */
export async function createSupplier(req, res) {
  try {
    const { name, phone, email, address, gstin } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Supplier name is required"
      });
    }

    const supplier = await SupplierLedger.create({
      name: name.trim(),
      phone: phone || "",
      email: email || "",
      address: address || "",
      gstin: gstin || "",
      seller: null,
      createdBy: req.user?._id,
      createdByRole: "Admin"
    });

    return res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      supplier
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * PUT /admin/pos/suppliers/:id — Update a supplier.
 */
export async function updateSupplier(req, res) {
  try {
    const { id } = req.params;
    const { name, phone, email, address, gstin } = req.body;

    const supplier = await SupplierLedger.findById(id);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found"
      });
    }

    if (name) supplier.name = name.trim();
    if (phone !== undefined) supplier.phone = phone;
    if (email !== undefined) supplier.email = email;
    if (address !== undefined) supplier.address = address;
    if (gstin !== undefined) supplier.gstin = gstin;

    await supplier.save();

    return res.json({
      success: true,
      message: "Supplier updated successfully",
      supplier
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * DELETE /admin/pos/suppliers/:id — Delete a supplier.
 */
export async function deleteSupplier(req, res) {
  try {
    const { id } = req.params;

    const supplier = await SupplierLedger.findByIdAndDelete(id);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found"
      });
    }

    // Delete associated transactions
    await SupplierTransaction.deleteMany({ supplier: id });

    return res.json({
      success: true,
      message: "Supplier and associated transactions deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * POST /admin/pos/suppliers/:id/debt — Record a purchase on credit (increase debt owed).
 */
export async function recordSupplierDebt(req, res) {
  try {
    const { id } = req.params;
    const { amount, invoiceNumber, note } = req.body;

    const debtAmount = Number(amount);
    if (isNaN(debtAmount) || debtAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid debt amount"
      });
    }

    const supplier = await SupplierLedger.findById(id);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found"
      });
    }

    supplier.totalDebt = (supplier.totalDebt || 0) + debtAmount;
    supplier.balance = (supplier.balance || 0) + debtAmount;
    await supplier.save();

    const transaction = await SupplierTransaction.create({
      supplier: supplier._id,
      type: "Debt",
      amount: debtAmount,
      balanceAfter: supplier.balance,
      invoiceNumber: invoiceNumber || "",
      note: note || "Purchase on credit",
      createdBy: req.user?._id
    });

    return res.json({
      success: true,
      message: "Debt recorded successfully",
      balance: supplier.balance,
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
 * POST /admin/pos/suppliers/:id/pay — Record payment to a supplier (decrease debt owed).
 */
export async function recordSupplierPayment(req, res) {
  try {
    const { id } = req.params;
    const { amount, paymentMethod = "Cash", note } = req.body;

    const paymentAmount = Number(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount"
      });
    }

    const supplier = await SupplierLedger.findById(id);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found"
      });
    }

    supplier.totalPaid = (supplier.totalPaid || 0) + paymentAmount;
    supplier.balance = (supplier.balance || 0) - paymentAmount;
    await supplier.save();

    const transaction = await SupplierTransaction.create({
      supplier: supplier._id,
      type: "Payment",
      amount: -paymentAmount, // Negative to denote cash paid/debt reduced
      balanceAfter: supplier.balance,
      paymentMethod,
      note: note || `Paid supplier via ${paymentMethod}`,
      createdBy: req.user?._id
    });

    return res.json({
      success: true,
      message: "Payment recorded successfully",
      balance: supplier.balance,
      transaction
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
