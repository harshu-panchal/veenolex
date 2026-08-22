import crypto from "crypto";
import axios from "axios";
import { PAYMENT_STATUS, PAYMENT_GATEWAY } from "../../../constants/payment.js";
import { PaymentProviderPort } from "../ports/paymentProviderPort.js";

// Razorpay caps the `receipt` field at 40 characters and rejects longer values
// with a 400 BAD_REQUEST_ERROR. Internal merchant order ids may exceed that.
const RAZORPAY_MAX_RECEIPT_LENGTH = 40;

/**
 * Normalise an Axios/gateway failure into an Error the controller can turn into
 * an accurate HTTP response instead of a blanket 500.
 */
function buildGatewayError(error, fallbackMessage) {
  const status = error?.response?.status || null;
  const gatewayError = error?.response?.data?.error || null;
  const description = gatewayError?.description || null;

  let statusCode;
  let message;

  if (status === 401 || status === 403) {
    // Bad/inactive API keys: an operator problem, not the caller's.
    statusCode = 502;
    message =
      "Payment gateway rejected our credentials. Please contact support.";
  } else if (status && status >= 400 && status < 500) {
    statusCode = 400;
    message = description || fallbackMessage;
  } else if (status && status >= 500) {
    statusCode = 502;
    message = description || "Payment gateway is temporarily unavailable";
  } else {
    // No HTTP response at all: timeout, DNS, connection refused.
    statusCode = 504;
    message = "Could not reach the payment gateway. Please try again.";
  }

  const err = new Error(message);
  err.statusCode = statusCode;
  err.gateway = PAYMENT_GATEWAY.RAZORPAY;
  err.gatewayStatus = status;
  err.gatewayCode = gatewayError?.code || error?.code || null;
  err.gatewayDescription = description;
  return err;
}

export class RazorpayAdapter extends PaymentProviderPort {
  get providerName() {
    return PAYMENT_GATEWAY.RAZORPAY;
  }

  _getAuthHeader() {
    const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
    const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
    if (!keyId || !keySecret) {
      const err = new Error(
        "Payment gateway is not configured. Please contact support.",
      );
      err.statusCode = 503;
      err.gateway = PAYMENT_GATEWAY.RAZORPAY;
      err.gatewayCode = "CREDENTIALS_MISSING";
      throw err;
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
      receipt: String(merchantOrderId).slice(0, RAZORPAY_MAX_RECEIPT_LENGTH),
    };

    // Resolved outside the try: a credentials-config error must keep its own
    // 503 rather than being re-wrapped as a gateway/network failure.
    const headers = this._getAuthHeader();

    try {
      const response = await axios.post(url, payload, {
        headers,
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
      throw buildGatewayError(error, "Failed to initiate payment with Razorpay");
    }
  }

  async getPaymentStatus({ merchantOrderId, gatewayOrderId }) {
    let orderId = gatewayOrderId;
    
    // If gatewayOrderId isn't passed, check if we can query by receipt/merchantOrderId via orders API
    if (!orderId) {
      throw new Error("gatewayOrderId (Razorpay Order ID) is required for Razorpay status verification");
    }

    const url = `https://api.razorpay.com/v1/orders/${orderId}`;
    const headers = this._getAuthHeader();

    try {
      const response = await axios.get(url, {
        headers,
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
      throw buildGatewayError(error, "Failed to verify status with Razorpay");
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

    const headers = this._getAuthHeader();

    try {
      const response = await axios.post(url, payload, {
        headers,
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
      throw buildGatewayError(error, "Failed to process refund with Razorpay");
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
