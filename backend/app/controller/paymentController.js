import handleResponse from "../utils/helper.js";
import {
  createPaymentOrderForOrderRef,
  verifyPhonePePaymentStatus,
  verifyRazorpaySignatureAndStatus,
  processPhonePeWebhook,
} from "../services/paymentService.js";
import {
  createPaymentOrderSchema,
  verifyPaymentClientSchema,
  validateSchema,
} from "../validation/paymentValidation.js";
import logger from "../services/logger.js";
import SellerProductRequest from "../models/sellerProductRequest.js";
import { getActivePaymentProvider } from "../services/payment/providerRegistry.js";

function resolvePaymentErrorMessage(error) {
  const directMessage = String(error?.message || "").trim();
  if (directMessage) return directMessage;

  const responseStatusText = String(error?.response?.statusText || "").trim();
  if (responseStatusText) return `PhonePe gateway error: ${responseStatusText}`;

  const causeCode = String(error?.cause?.code || error?.code || "").trim();
  if (causeCode) return `PhonePe gateway request failed (${causeCode})`;

  return "Unable to initiate payment with PhonePe right now";
}

export const createPaymentOrder = async (req, res) => {
  try {
    const payload = validateSchema(createPaymentOrderSchema, req.body || {});
    const result = await createPaymentOrderForOrderRef({
      orderRef: payload.orderRef || payload.orderId,
      userId: req.user?.id,
      idempotencyKey: req.headers["idempotency-key"] || null,
      correlationId: req.correlationId || null,
    });

    return handleResponse(
      res,
      result.duplicate ? 200 : 201,
      result.duplicate ? "Re-using existing payment" : "Payment initiated",
      {
        payment: result.payment,
        redirectUrl: result.redirectUrl,
        merchantOrderId: result.payment.gatewayOrderId,
        gatewayResponse: result.gatewayResponse || result.payment.rawGatewayResponse,
      },
    );
  } catch (error) {
    logger.error("createPaymentOrder failed", {
      scope: "PaymentController.createPaymentOrder",
      message: error?.message,
      statusCode: error?.statusCode || error?.status || 500,
      code: error?.code || error?.cause?.code || null,
      responseStatus: error?.response?.status || null,
      responseStatusText: error?.response?.statusText || null,
      orderRef: req.body?.orderRef || req.body?.orderId || null,
      userId: req.user?.id || null,
      correlationId: req.correlationId || null,
    });
    return handleResponse(
      res,
      error.statusCode || error.status || 500,
      resolvePaymentErrorMessage(error),
    );
  }
};

export const verifyPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const merchantOrderId = id || req.query.merchantOrderId;
    
    if (!merchantOrderId) {
        return handleResponse(res, 400, "merchantOrderId is required");
    }

    const verification = await verifyPhonePePaymentStatus({
      merchantOrderId,
      userId: req.user?.id,
      correlationId: req.correlationId || null,
    });

    return handleResponse(res, 200, "Payment status verified", {
      status: verification.status,
      payment: verification.payment,
    });
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

export const handlePhonePeWebhook = async (req, res) => {
  try {
    const authorization = req.headers["x-verify"] || req.headers["authorization"];
    const rawBody = req.body;

    if (!authorization) {
        logger.warn("PhonePe webhook missing verification header", {
          scope: "PaymentController.handlePhonePeWebhook",
          correlationId: req.correlationId || null,
          ip: req.ip,
        });
        return res.status(401).send("Unauthorized");
    }

    const result = await processPhonePeWebhook({
      rawBody,
      authorization,
      correlationId: req.correlationId || null,
    });

    if (result.accepted) {
      return res.status(200).send("OK");
    }
    
    return res.status(400).send("Bad Request");
  } catch (error) {
    logger.error("PhonePe webhook processing failed", {
      scope: "PaymentController.handlePhonePeWebhook",
      correlationId: req.correlationId || null,
      message: error?.message,
      error,
    });
    return res.status(500).send("Internal Server Error");
  }
};

export const getPaymentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const merchantOrderId = id;
    
        const verification = await verifyPhonePePaymentStatus({
          merchantOrderId,
          userId: req.user?.id,
          correlationId: req.correlationId || null,
        });
    
        return handleResponse(res, 200, "Payment status retrieved", {
          status: verification.status,
          merchantOrderId: verification.payment.gatewayOrderId,
          amount: verification.payment.amount,
          currency: verification.payment.currency,
        });
      } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
      }
};

export const handlePhonePeSellerWebhook = async (req, res) => {
  try {
    const authorization = req.headers["x-verify"] || req.headers["authorization"];
    const rawBody = req.body;

    if (!authorization) {
      logger.warn("PhonePe seller webhook missing verification header");
      return res.status(401).send("Unauthorized");
    }

    const provider = getActivePaymentProvider();
    const isValid = await provider.validateWebhook({ rawBody, authorization });
    if (!isValid) {
      return res.status(401).send("Unauthorized");
    }

    const payload = await provider.decodeWebhookPayload({ rawBody });
    const { merchantOrderId, state, transactionId } = payload;

    const request = await SellerProductRequest.findOne({ requestNumber: merchantOrderId });
    if (!request) {
      logger.warn(`Seller request not found for webhook: ${merchantOrderId}`);
      return res.status(200).send("OK"); // Acknowledge to stop retries
    }

    if (state === "COMPLETED") {
      request.paymentStatus = "PAID";
      request.paidAt = new Date();
    } else if (state === "FAILED") {
      request.paymentStatus = "FAILED";
    }
    
    if (transactionId) {
      request.transactionId = transactionId;
    }

    await request.save();
    return res.status(200).send("OK");

  } catch (error) {
    logger.error("PhonePe seller webhook failed", { message: error.message });
    return res.status(500).send("Internal Server Error");
  }
};

export const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return handleResponse(res, 400, "razorpay_order_id, razorpay_payment_id and razorpay_signature are required");
    }

    const verification = await verifyRazorpaySignatureAndStatus({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      userId: req.user?.id,
      correlationId: req.correlationId || null,
    });

    return handleResponse(res, 200, "Razorpay payment verified successfully", {
      status: verification.status,
      payment: verification.payment,
    });
  } catch (error) {
    logger.error("verifyRazorpayPayment failed:", {
      scope: "PaymentController.verifyRazorpayPayment",
      message: error.message,
      userId: req.user?.id,
      correlationId: req.correlationId || null,
    });
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};
