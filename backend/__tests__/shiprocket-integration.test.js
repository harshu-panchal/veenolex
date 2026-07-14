import { jest } from "@jest/globals";
import crypto from "crypto";

const mockOrderFindOne = jest.fn();
const mockSellerProductRequestFindOne = jest.fn();
const mockDeliveryShipmentFindOne = jest.fn();
const mockDeliveryWebhookEventFindOne = jest.fn();
const mockDeliveryWebhookEventCreate = jest.fn();

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: {
    findOne: mockOrderFindOne,
  },
}));

jest.unstable_mockModule("../app/models/sellerProductRequest.js", () => ({
  default: {
    findOne: mockSellerProductRequestFindOne,
  },
}));

jest.unstable_mockModule("../app/models/deliveryShipment.js", () => ({
  default: {
    findOne: mockDeliveryShipmentFindOne,
  },
}));

jest.unstable_mockModule("../app/models/deliveryWebhookEvent.js", () => ({
  default: {
    findOne: mockDeliveryWebhookEventFindOne,
    create: mockDeliveryWebhookEventCreate,
  },
}));

jest.unstable_mockModule("../app/services/orderSocketEmitter.js", () => ({
  emitToOrder: jest.fn(),
}));

const { handleShiprocketWebhook } = await import("../app/controller/deliveryWebhookController.js");

describe("Shiprocket Webhook and Idempotency handling", () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SHIPROCKET_WEBHOOK_SECRET = "test_webhook_secret";

    mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    delete process.env.SHIPROCKET_WEBHOOK_SECRET;
  });

  it("returns 401 for invalid signature", async () => {
    const rawPayload = JSON.stringify({ event_id: "evt_123", order_id: "100" });
    
    mockReq = {
      headers: {
        "x-sha256-signature": "wrong_signature",
      },
      body: Buffer.from(rawPayload),
    };

    await handleShiprocketWebhook(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining("Invalid signature"));
    expect(mockDeliveryWebhookEventCreate).not.toHaveBeenCalled();
  });

  it("handles duplicate webhook event ID as a no-op (idempotency)", async () => {
    const rawPayload = JSON.stringify({ event_id: "evt_123", order_id: "100" });
    
    // Mock that the event ID already exists in DB
    mockDeliveryWebhookEventFindOne.mockResolvedValueOnce({ eventId: "evt_123" });

    const signature = crypto
      .createHmac("sha256", "test_webhook_secret")
      .update(rawPayload)
      .digest("hex");

    mockReq = {
      headers: {
        "x-sha256-signature": signature,
      },
      body: Buffer.from(rawPayload),
    };

    await handleShiprocketWebhook(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining("Duplicate event ignored"));
    expect(mockOrderFindOne).not.toHaveBeenCalled();
  });

  it("logs and returns 200 for a shipRocketOrderId that does not exist in DB", async () => {
    const rawPayload = JSON.stringify({ event_id: "evt_456", order_id: "missing_999", status: "SHIPPED" });
    
    mockDeliveryWebhookEventFindOne.mockResolvedValueOnce(null); // Not duplicate
    mockOrderFindOne.mockResolvedValueOnce(null);
    mockSellerProductRequestFindOne.mockResolvedValueOnce(null);

    const signature = crypto
      .createHmac("sha256", "test_webhook_secret")
      .update(rawPayload)
      .digest("hex");

    mockReq = {
      headers: {
        "x-sha256-signature": signature,
      },
      body: Buffer.from(rawPayload),
    };

    await handleShiprocketWebhook(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining("Discarded (Order not found)"));
    expect(mockDeliveryWebhookEventCreate).toHaveBeenCalled();
  });

  it("processes unmapped status by storing in timeline, without changing order workflowStatus", async () => {
    const rawPayload = JSON.stringify({ 
      event_id: "evt_789", 
      order_id: "order_123", 
      status: "IN_TRANSIT_UNMAPPED" 
    });

    const mockOrder = {
      orderId: "ORD123",
      shipRocketDetails: { orderId: "order_123", status: "NEW" },
      workflowStatus: "SELLER_PENDING",
      save: jest.fn().mockResolvedValue(true),
    };

    mockDeliveryWebhookEventFindOne.mockResolvedValueOnce(null);
    mockOrderFindOne.mockResolvedValueOnce(mockOrder);
    
    const mockShipment = {
      timeline: [],
      save: jest.fn().mockResolvedValue(true),
    };
    mockDeliveryShipmentFindOne.mockResolvedValueOnce(mockShipment);

    const signature = crypto
      .createHmac("sha256", "test_webhook_secret")
      .update(rawPayload)
      .digest("hex");

    mockReq = {
      headers: {
        "x-sha256-signature": signature,
      },
      body: Buffer.from(rawPayload),
    };

    await handleShiprocketWebhook(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining("Webhook processed successfully"));
    expect(mockShipment.timeline.length).toBe(1);
    expect(mockShipment.timeline[0].status).toBe("IN_TRANSIT_UNMAPPED");
    expect(mockOrder.workflowStatus).toBe("SELLER_PENDING"); // unchanged
  });
});
