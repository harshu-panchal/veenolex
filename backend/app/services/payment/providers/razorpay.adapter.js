import crypto from "crypto";
import axios from "axios";
import { PAYMENT_STATUS, PAYMENT_GATEWAY } from "../../../constants/payment.js";
import { PaymentProviderPort } from "../ports/paymentProviderPort.js";

export class RazorpayAdapter extends PaymentProviderPort {
  get providerName() {
    return PAYMENT_GATEWAY.RAZORPAY;
  }

  _getAuthHeader() {
    const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
    const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
    if (!keyId || !keySecret) {
      throw new Error("Razorpay credentials not configured");
    }
    return {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    };
  }

  async initiatePayment({ merchantOrderId, amountPaise, redirectUrl }) {
    const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
    const url = "https://api.razorpay.com/v1/orders";
    const payload = {
      amount: amountPaise,
      currency: "INR",
      receipt: merchantOrderId,
    };

    try {
      const response = await axios.post(url, payload, {
        headers: this._getAuthHeader(),
        timeout: 10000, // 10s timeout
      });

      const orderData = response.data;
      // Return details needed for opening Razorpay checkout JS overlay on frontend
      return {
        redirectUrl: `${process.env.FRONTEND_URL}/payments/checkout?merchantOrderId=${merchantOrderId}`,
        gatewayResponse: {
          id: orderData.id,
          amount: orderData.amount,
          currency: orderData.currency,
          keyId: keyId,
        },
      };
    } catch (error) {
      console.error("❌ Razorpay order creation failed:", error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.description || "Failed to initiate payment with Razorpay");
    }
  }

  async getPaymentStatus({ merchantOrderId, gatewayOrderId }) {
    let orderId = gatewayOrderId;
    
    // If gatewayOrderId isn't passed, check if we can query by receipt/merchantOrderId via orders API
    if (!orderId) {
      throw new Error("gatewayOrderId (Razorpay Order ID) is required for Razorpay status verification");
    }

    const url = `https://api.razorpay.com/v1/orders/${orderId}`;
    try {
      const response = await axios.get(url, {
        headers: this._getAuthHeader(),
        timeout: 10000,
      });

      const orderData = response.data;
      return {
        state: orderData.status, // "created", "attempted", "paid"
        transactionId: null, // will be resolved on payments list if needed
        responseCode: orderData.status,
        gatewayResponse: orderData,
      };
    } catch (error) {
      console.error("❌ Razorpay getPaymentStatus failed:", error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.description || "Failed to verify status with Razorpay");
    }
  }

  async refund({ gatewayPaymentId, amountPaise, reason }) {
    if (!gatewayPaymentId) {
      throw new Error("gatewayPaymentId is required for Razorpay refund");
    }

    const url = `https://api.razorpay.com/v1/payments/${gatewayPaymentId}/refund`;
    const payload = {
      amount: amountPaise,
      notes: {
        reason: reason || "Admin initiated refund",
      },
    };

    try {
      const response = await axios.post(url, payload, {
        headers: this._getAuthHeader(),
        timeout: 10000,
      });

      const refundData = response.data;
      return {
        refundId: refundData.id,
        status: refundData.status, // "pending", "processed", "failed"
        amount: refundData.amount,
        gatewayResponse: refundData,
      };
    } catch (error) {
      console.error("❌ Razorpay refund failed:", error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.description || "Failed to process refund with Razorpay");
    }
  }

  async validateWebhook({ rawBody, authorization }) {
    // Stub validateWebhook as no-webhook constraint is requested
    return false;
  }

  async decodeWebhookPayload({ rawBody }) {
    return {
      eventId: crypto.randomUUID(),
      merchantOrderId: "",
      state: "failed",
      transactionId: null,
      responseCode: "failed",
      raw: {},
    };
  }

  mapStatusToInternal(gatewayState) {
    const normalized = String(gatewayState || "").toUpperCase();
    if (normalized === "PAID") return PAYMENT_STATUS.CAPTURED;
    if (normalized === "FAILED") return PAYMENT_STATUS.FAILED;
    if (normalized === "CREATED" || normalized === "ATTEMPTED") return PAYMENT_STATUS.PENDING;
    return PAYMENT_STATUS.PENDING;
  }
}

export default RazorpayAdapter;
