/**
 * posPhonepeService.js — POS-specific PhonePe payment flow service.
 *
 * Implements:
 * 1. POS Online checkout initiation (creates pending order + gets redirect URL)
 * 2. POS payment verification (checks PhonePe + updates order to Paid/Failed)
 * 3. Credit repayment online initiation
 * 4. Credit repayment online verification
 */

import Order from "../../models/order.js";
import User from "../../models/customer.js";
import CreditTransaction from "../../models/creditTransaction.js";
import { getActivePaymentProvider } from "../payment/providerRegistry.js";

/**
 * Initiate PhonePe payment for a POS Order.
 *
 * @param {string} orderId - Mongoose Order _id
 * @param {string} redirectUrl - Frontend callback redirection URL
 * @returns {Promise<{ redirectUrl: string }>} PhonePe payment session redirect
 */
export async function initiatePOSPhonePePayment(orderId, redirectUrl) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error("Order not found");
  }

  const provider = getActivePaymentProvider();
  const totalAmount = order.pricing?.total || order.paymentBreakdown?.grandTotal || 0;

  if (totalAmount <= 0) {
    throw new Error("POS Order total must be greater than zero to pay online");
  }

  // PhonePe amount is in Paise (1 INR = 100 Paise)
  const amountPaise = Math.round(totalAmount * 100);

  const response = await provider.initiatePayment({
    merchantOrderId: order.orderId,
    amountPaise,
    redirectUrl
  });

  return { redirectUrl: response.redirectUrl };
}

/**
 * Verify PhonePe payment status for a POS order and mark it Paid.
 *
 * @param {string} publicOrderId - The public orderId string (e.g. ORD-xxx)
 * @returns {Promise<{ success: boolean, order: Object }>} Resulting order status
 */
export async function verifyPOSPhonePePayment(publicOrderId) {
  const order = await Order.findOne({ orderId: publicOrderId });
  if (!order) {
    throw new Error("Order not found");
  }

  const provider = getActivePaymentProvider();
  const status = await provider.getPaymentStatus({ merchantOrderId: publicOrderId });

  const mappedStatus = provider.mapStatusToInternal(status.state);

  if (mappedStatus === "CAPTURED") {
    // Payment Successful
    order.paymentStatus = "PAID";
    order.payment = {
      ...order.payment,
      status: "completed"
    };
    await order.save();

    return { success: true, order };
  } else if (mappedStatus === "FAILED" || mappedStatus === "CANCELLED") {
    order.paymentStatus = "FAILED";
    order.payment = {
      ...order.payment,
      status: "failed"
    };
    await order.save();

    // Note: Stock is NOT automatically restored for failed/cancelled cashiers
    // unless manually requested or order deleted, matching Veenolex stock release logic.
    return { success: false, order };
  }

  // Still pending / created
  return { success: false, order };
}

/**
 * Initiate PhonePe payment for credit (udhaar) repayment.
 *
 * Generates a special tracking ID: CRD-PAY-XXXXX
 *
 * @param {Object} params
 * @param {string} params.customerId
 * @param {number} params.amount
 * @param {string} params.redirectUrl
 * @param {string} params.sellerId - Optional seller scope
 * @returns {Promise<{ redirectUrl: string, merchantOrderId: string }>}
 */
export async function initiatePOSCreditPhonePeRepayment({
  customerId,
  amount,
  redirectUrl,
  sellerId = null
}) {
  const customer = await User.findById(customerId);
  if (!customer) {
    throw new Error("Customer not found");
  }

  const paymentAmount = Number(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    throw new Error("Invalid payment amount");
  }

  const provider = getActivePaymentProvider();
  const amountPaise = Math.round(paymentAmount * 100);

  // Generate a distinct transaction ID
  const timestamp = Date.now();
  const merchantOrderId = `CRD-PAY-${customerId.slice(-6)}-${timestamp}`;

  const response = await provider.initiatePayment({
    merchantOrderId,
    amountPaise,
    redirectUrl
  });

  return {
    redirectUrl: response.redirectUrl,
    merchantOrderId
  };
}

/**
 * Verify credit PhonePe repayment status and deduct customer's credit balance.
 *
 * @param {string} merchantOrderId - e.g. CRD-PAY-XXXXX
 * @param {string} createdById - Operator who initiated
 * @param {string} createdByRole - "Admin" | "Seller"
 * @returns {Promise<{ success: boolean, creditBalance: number, transaction: Object }>}
 */
export async function verifyPOSCreditPhonePeRepayment({
  merchantOrderId,
  createdById,
  createdByRole = "Admin"
}) {
  // Parse customerId from merchantOrderId: CRD-PAY-<custSuffix>-<timestamp>
  // Better yet, search CreditTransaction or query PhonePe directly.
  const provider = getActivePaymentProvider();
  const status = await provider.getPaymentStatus({ merchantOrderId });

  const mappedStatus = provider.mapStatusToInternal(status.state);

  if (mappedStatus === "CAPTURED") {
    // Prevent duplicate processing of the same merchantOrderId
    const existingTx = await CreditTransaction.findOne({ transactionId: merchantOrderId });
    if (existingTx) {
      const customer = await User.findById(existingTx.customer).select("creditBalance").lean();
      return { success: true, creditBalance: customer.creditBalance, transaction: existingTx };
    }

    // Parse the repayment amount from PhonePe gateway response (convert paise to rupees)
    const amountPaise = Number(status.gatewayResponse?.amount || 0);
    const amountRupees = amountPaise / 100;

    // Parse customer suffix or retrieve customer record by searching
    // Since merchantOrderId is formatted as CRD-PAY-<suffix>-<timestamp>,
    // let's retrieve the customer by querying the transaction prefix or checking.
    // To be 100% robust, we'll locate customer using the ID suffix match.
    const parts = merchantOrderId.split("-");
    const custSuffix = parts[2];

    const customer = await User.findOne({
      role: "user",
      _id: { $regex: new RegExp(`${custSuffix}$`, "i") }
    });

    if (!customer) {
      throw new Error(`Failed to locate customer from transaction ID ${merchantOrderId}`);
    }

    // Deduct credit balance
    customer.creditBalance = Math.max(0, (customer.creditBalance || 0) - amountRupees);
    await customer.save();

    const transaction = await CreditTransaction.create({
      customer: customer._id,
      type: "Payment",
      amount: -amountRupees, // Negative amount in ledger signifies payment/reduction of debt
      balanceAfter: customer.creditBalance,
      paymentMethod: "Online",
      transactionId: merchantOrderId,
      note: `Online credit repayment via PhonePe (${merchantOrderId})`,
      createdBy: createdById,
      createdByRole,
      seller: customer.sellerId || undefined
    });

    return {
      success: true,
      creditBalance: customer.creditBalance,
      transaction
    };
  }

  return { success: false, creditBalance: 0, transaction: null };
}
