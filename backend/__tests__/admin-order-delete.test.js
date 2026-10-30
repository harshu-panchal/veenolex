import { jest } from "@jest/globals";

const mockOrderFindOne = jest.fn();
const mockOrderDeleteOne = jest.fn();
const mockOrderFind = jest.fn();
const mockOrderDeleteMany = jest.fn();
const mockOrderOtpDeleteMany = jest.fn();

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: {
    findOne: mockOrderFindOne,
    deleteOne: mockOrderDeleteOne,
    find: mockOrderFind,
    deleteMany: mockOrderDeleteMany,
  },
}));

jest.unstable_mockModule("../app/models/orderOtp.js", () => ({
  default: {
    deleteMany: mockOrderOtpDeleteMany,
  },
}));

jest.unstable_mockModule("../app/services/cacheService.js", () => ({
  buildKey: (...parts) => parts.join(":"),
  getOrSet: jest.fn(),
  getTTL: () => 60,
  invalidate: jest.fn(),
}));

jest.unstable_mockModule("../app/services/logger.js", () => ({
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const { deleteOrder, deleteOrdersBulk } = await import(
  "../app/controller/orderController.js"
);

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("deleteOrder Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 404 when order does not exist", async () => {
    mockOrderFindOne.mockResolvedValue(null);
    const req = { params: { orderId: "ORD99999" } };
    const res = mockRes();

    await deleteOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "Order not found" })
    );
  });

  test("deletes single order and cleans up OTPs", async () => {
    const dummyOrder = {
      _id: "661234567890123456789012",
      orderId: "ORD12345",
      customer: "cust-1",
    };
    mockOrderFindOne.mockResolvedValue(dummyOrder);
    mockOrderDeleteOne.mockResolvedValue({ deletedCount: 1 });
    mockOrderOtpDeleteMany.mockResolvedValue({ deletedCount: 1 });

    const req = { params: { orderId: "ORD12345" } };
    const res = mockRes();

    await deleteOrder(req, res);

    expect(mockOrderOtpDeleteMany).toHaveBeenCalledWith({ orderId: "ORD12345" });
    expect(mockOrderDeleteOne).toHaveBeenCalledWith({ _id: dummyOrder._id });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Order deleted successfully",
      })
    );
  });

  test("bulk deletes orders when orderIds provided", async () => {
    const dummyOrders = [
      { _id: "661234567890123456789011", orderId: "ORD101" },
      { _id: "661234567890123456789012", orderId: "ORD102" },
    ];
    mockOrderFind.mockReturnValue({
      select: () => ({
        lean: async () => dummyOrders,
      }),
    });
    mockOrderDeleteMany.mockResolvedValue({ deletedCount: 2 });
    mockOrderOtpDeleteMany.mockResolvedValue({ deletedCount: 2 });

    const req = { body: { orderIds: ["ORD101", "ORD102"] } };
    const res = mockRes();

    await deleteOrdersBulk(req, res);

    expect(mockOrderDeleteMany).toHaveBeenCalledWith({
      _id: { $in: dummyOrders.map((o) => o._id) },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "2 orders deleted successfully",
      })
    );
  });

  test("returns 400 when bulk delete orderIds is empty or invalid", async () => {
    const req = { body: { orderIds: [] } };
    const res = mockRes();

    await deleteOrdersBulk(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("seller can delete their own order", async () => {
    const dummyOrder = {
      _id: "661234567890123456789099",
      orderId: "ORD99999",
      seller: "seller-123",
      customer: "cust-1",
    };
    mockOrderFindOne.mockResolvedValue(dummyOrder);
    mockOrderDeleteOne.mockResolvedValue({ deletedCount: 1 });
    mockOrderOtpDeleteMany.mockResolvedValue({ deletedCount: 0 });

    const req = {
      params: { orderId: "ORD99999" },
      user: { id: "seller-123", role: "seller" },
    };
    const res = mockRes();

    await deleteOrder(req, res);

    expect(mockOrderDeleteOne).toHaveBeenCalledWith({ _id: dummyOrder._id });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("seller receives 403 when trying to delete another seller's order", async () => {
    const dummyOrder = {
      _id: "661234567890123456789099",
      orderId: "ORD99999",
      seller: "seller-different",
      customer: "cust-1",
    };
    mockOrderFindOne.mockResolvedValue(dummyOrder);

    const req = {
      params: { orderId: "ORD99999" },
      user: { id: "seller-123", role: "seller" },
    };
    const res = mockRes();

    await deleteOrder(req, res);

    expect(mockOrderDeleteOne).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
