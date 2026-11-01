import { jest } from "@jest/globals";
import crypto from "crypto";

const mockRequests = [];

const mockFindById = jest.fn((id) => {
  const req = mockRequests.find((r) => String(r._id) === String(id));
  return Promise.resolve(req || null);
});

jest.unstable_mockModule("../app/models/sellerProductRequest.js", () => ({
  default: {
    findById: mockFindById,
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

jest.unstable_mockModule("../app/services/sellerRequestFulfillmentService.js", () => ({
  reserveWarehouseStockForRequest: jest.fn().mockResolvedValue({ reserved: true }),
  releaseWarehouseStockForRequest: jest.fn().mockResolvedValue({ released: true }),
  notifyRiderOfRequestAssignment: jest.fn().mockResolvedValue(true),
  materializeSellerRequestStock: jest.fn().mockResolvedValue({ materialized: true }),
}));

jest.unstable_mockModule("../app/services/payment/providerRegistry.js", () => ({
  getActivePaymentProvider: jest.fn(),
}));

jest.unstable_mockModule("../utils/shipRocketService.js", () => ({
  createShipRocketOrderForRequest: jest.fn(),
}));

jest.unstable_mockModule("../app/queues/orderQueues.js", () => ({
  sellerTimeoutQueue: { add: jest.fn() },
  deliveryTimeoutQueue: { add: jest.fn() },
  returnPickupTimeoutQueue: { add: jest.fn() },
  rescheduleQueue: { add: jest.fn() },
  shiprocketQueue: { add: jest.fn() },
  JOB_NAMES: {},
}));

const { fallbackToPayAfterDelivery, verifySellerRequestRazorpay } = await import(
  "../app/controller/sellerProductRequestController.js"
);

describe("Seller Product Request Payment Fallback & Razorpay Verify", () => {
  beforeEach(() => {
    mockRequests.length = 0;
    jest.clearAllMocks();
  });

  test("fallbackToPayAfterDelivery switches paymentType to PAY_AFTER_DELIVERY with PENDING status", async () => {
    const request = {
      _id: "req-1",
      requestNumber: "REQ-2026-001",
      sellerId: "seller-123",
      paymentType: "PAY_NOW",
      paymentStatus: "PENDING",
      save: jest.fn(async function () {
        return this;
      }),
    };
    mockRequests.push(request);

    const req = {
      params: { requestId: "req-1" },
      user: { id: "seller-123", role: "seller" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await fallbackToPayAfterDelivery(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(request.paymentType).toBe("PAY_AFTER_DELIVERY");
    expect(request.paymentStatus).toBe("PENDING");
    expect(request.save).toHaveBeenCalled();
  });

  test("fallbackToPayAfterDelivery returns 400 if request is already PAID", async () => {
    const request = {
      _id: "req-2",
      requestNumber: "REQ-2026-002",
      sellerId: "seller-123",
      paymentType: "PAY_NOW",
      paymentStatus: "PAID",
      save: jest.fn(),
    };
    mockRequests.push(request);

    const req = {
      params: { requestId: "req-2" },
      user: { id: "seller-123", role: "seller" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await fallbackToPayAfterDelivery(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(request.save).not.toHaveBeenCalled();
  });

  test("verifySellerRequestRazorpay verifies valid signature and sets paymentStatus to PAID", async () => {
    process.env.RAZORPAY_KEY_SECRET = "test_secret_123";

    const orderId = "order_rzp_123";
    const paymentId = "pay_rzp_456";
    const signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const request = {
      _id: "req-3",
      requestNumber: "REQ-2026-003",
      sellerId: "seller-123",
      paymentType: "PAY_NOW",
      paymentStatus: "PENDING",
      status: "PENDING",
      save: jest.fn(async function () {
        return this;
      }),
    };
    mockRequests.push(request);

    const req = {
      params: { requestId: "req-3" },
      user: { id: "seller-123", role: "seller" },
      body: {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await verifySellerRequestRazorpay(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(request.paymentStatus).toBe("PAID");
    expect(request.transactionId).toBe(paymentId);
    expect(request.paidAt).toBeInstanceOf(Date);
    expect(request.save).toHaveBeenCalled();
  });

  test("verifySellerRequestRazorpay returns 400 for invalid signature", async () => {
    process.env.RAZORPAY_KEY_SECRET = "test_secret_123";

    const request = {
      _id: "req-4",
      requestNumber: "REQ-2026-004",
      sellerId: "seller-123",
      paymentType: "PAY_NOW",
      paymentStatus: "PENDING",
      save: jest.fn(),
    };
    mockRequests.push(request);

    const req = {
      params: { requestId: "req-4" },
      user: { id: "seller-123", role: "seller" },
      body: {
        razorpay_order_id: "order_rzp_123",
        razorpay_payment_id: "pay_rzp_456",
        razorpay_signature: "invalid_signature",
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await verifySellerRequestRazorpay(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(request.save).not.toHaveBeenCalled();
  });
});
