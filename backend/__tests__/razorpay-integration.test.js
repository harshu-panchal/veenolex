import { jest } from "@jest/globals";
import crypto from "crypto";

const mockPaymentFindOne = jest.fn();
const mockPaymentCreate = jest.fn();
const mockPaymentUpdateOne = jest.fn();
const mockOrderFindOne = jest.fn();
const mockOrderFindById = jest.fn();
const mockOrderUpdateMany = jest.fn();
const mockOrderUpdateOne = jest.fn();
const mockOrderFindOneAndUpdate = jest.fn();
const mockCheckoutGroupUpdateOne = jest.fn();
const mockEmitNotificationEvent = jest.fn();
const mockHandleOnlineOrderFinance = jest.fn();

jest.unstable_mockModule("../app/models/payment.js", () => ({
  default: {
    findOne: mockPaymentFindOne,
    create: mockPaymentCreate,
    updateOne: mockPaymentUpdateOne,
  },
}));

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: {
    findOne: mockOrderFindOne,
    findById: mockOrderFindById,
    updateMany: mockOrderUpdateMany,
    updateOne: mockOrderUpdateOne,
    findOneAndUpdate: mockOrderFindOneAndUpdate,
  },
}));

jest.unstable_mockModule("../app/models/checkoutGroup.js", () => ({
  default: {
    updateOne: mockCheckoutGroupUpdateOne,
  },
}));

jest.unstable_mockModule("../modules/notifications/notification.emitter.js", () => ({
  emitNotificationEvent: mockEmitNotificationEvent,
}));

jest.unstable_mockModule("../app/services/finance/orderFinanceService.js", () => ({
  handleOnlineOrderFinance: mockHandleOnlineOrderFinance,
}));

// Load dependencies
const { verifyRazorpaySignatureAndStatus } = await import("../app/services/paymentService.js");
const { RazorpayAdapter } = await import("../app/services/payment/providers/razorpay.adapter.js");

describe("Razorpay Integration & Verification Flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RAZORPAY_KEY_ID = "test_key_id";
    process.env.RAZORPAY_KEY_SECRET = "test_key_secret";
  });

  afterEach(() => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
  });

  describe("RazorpayAdapter", () => {
    it("correctly maps Razorpay status to PAYMENT_STATUS constants", () => {
      const adapter = new RazorpayAdapter();
      expect(adapter.mapStatusToInternal("paid")).toBe("CAPTURED");
      expect(adapter.mapStatusToInternal("created")).toBe("PENDING");
      expect(adapter.mapStatusToInternal("attempted")).toBe("PENDING");
      expect(adapter.mapStatusToInternal("failed")).toBe("FAILED");
    });
  });

  describe("verifyRazorpaySignatureAndStatus", () => {
    it("fails verification if the signature is invalid", async () => {
      const orderId = "order_123";
      const paymentId = "pay_123";
      const invalidSignature = "invalid_sig";

      await expect(
        verifyRazorpaySignatureAndStatus({
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: invalidSignature,
          userId: "user_123",
        })
      ).rejects.toThrow("Invalid Razorpay payment signature");
    });

    it("accepts a genuinely signed Razorpay callback payload", async () => {
      const orderId = "order_123";
      const paymentId = "pay_123";
      const signature = crypto
        .createHmac("sha256", "test_key_secret")
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      const mockPayment = {
        _id: "pay_doc_123",
        customer: "user_123",
        gatewayOrderId: orderId,
        status: "PENDING",
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };

      mockPaymentFindOne.mockResolvedValueOnce(mockPayment);
      mockOrderFindById.mockResolvedValue({
        _id: "ord_1",
        orderId: "ORD-1",
        customer: "user_123",
        paymentMode: "ONLINE",
        save: jest.fn(),
      });

      // Stub Razorpay API status fetch
      const adapter = new RazorpayAdapter();
      jest.spyOn(adapter, "getPaymentStatus").mockResolvedValueOnce({
        state: "paid",
        transactionId: paymentId,
        responseCode: "paid",
        gatewayResponse: { status: "paid" },
      });

      // Swap active provider registry resolution
      jest.unstable_mockModule("../app/services/payment/providerRegistry.js", () => ({
        getActivePaymentProvider: () => adapter,
      }));

      // Dynamically load updated registry
      const { getActivePaymentProvider } = await import("../app/services/payment/providerRegistry.js");

      // Verify
      const result = await verifyRazorpaySignatureAndStatus({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
        userId: "user_123",
      });

      expect(result.status).toBe("CAPTURED");
      expect(mockPayment.save).toHaveBeenCalled();
    });
  });
});
