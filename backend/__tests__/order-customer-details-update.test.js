import { jest } from "@jest/globals";

const mockOrders = [];

const mockOrderFindOne = jest.fn((query) => {
  const order = mockOrders.find((o) => {
    if (query.orderId) return o.orderId === query.orderId;
    if (query._id) return String(o._id) === String(query._id);
    if (query.$or) {
      return query.$or.some((c) => (c.orderId && o.orderId === c.orderId) || (c._id && String(o._id) === String(c._id)));
    }
    return false;
  });
  return Promise.resolve(order || null);
});

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: {
    findOne: mockOrderFindOne,
    find: jest.fn(() => ({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(mockOrders) })),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  },
}));

jest.unstable_mockModule("../app/services/cacheService.js", () => ({
  invalidate: jest.fn().mockResolvedValue(true),
  buildKey: jest.fn((...args) => args.join(":")),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
  del: jest.fn().mockResolvedValue(true),
  delPattern: jest.fn().mockResolvedValue(true),
  getOrSet: jest.fn((key, cb) => cb()),
  subscribeToInvalidations: jest.fn(),
  getTTL: jest.fn(() => 60),
  default: {
    invalidate: jest.fn().mockResolvedValue(true),
    buildKey: jest.fn((...args) => args.join(":")),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true),
    delPattern: jest.fn().mockResolvedValue(true),
    getOrSet: jest.fn((key, cb) => cb()),
    subscribeToInvalidations: jest.fn(),
    getTTL: jest.fn(() => 60),
  },
}));

const { updateOrderCustomerDetails } = await import("../app/controller/orderController.js");

describe("Order Customer Details Update", () => {
  beforeEach(() => {
    mockOrders.length = 0;
    jest.clearAllMocks();
  });

  test("successfully updates customerName, phone, and address on existing order", async () => {
    const existingOrder = {
      _id: "order-123",
      orderId: "ORD-01M6CDHVYAG",
      customerName: "Walk-in Customer",
      customerPhone: "0000000000",
      customerAddress: "Old Address",
      address: {
        name: "Walk-in Customer",
        phone: "0000000000",
        address: "Old Address",
      },
      save: jest.fn(async function () {
        return this;
      }),
    };
    mockOrders.push(existingOrder);

    const req = {
      params: { orderId: "ORD-01M6CDHVYAG" },
      user: { id: "admin-1", role: "admin" },
      body: {
        name: "Prathmesh Jawade",
        phone: "+919876543210",
        address: "8B Annpurna Nagar, Udaipur",
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await updateOrderCustomerDetails(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(existingOrder.customerName).toBe("Prathmesh Jawade");
    expect(existingOrder.address.name).toBe("Prathmesh Jawade");
    expect(existingOrder.customerPhone).toBe("+919876543210");
    expect(existingOrder.address.phone).toBe("+919876543210");
    expect(existingOrder.customerAddress).toBe("8B Annpurna Nagar, Udaipur");
    expect(existingOrder.address.address).toBe("8B Annpurna Nagar, Udaipur");
    expect(existingOrder.save).toHaveBeenCalled();
  });

  test("returns 404 if order is not found", async () => {
    const req = {
      params: { orderId: "NON-EXISTENT" },
      user: { id: "admin-1", role: "admin" },
      body: { name: "Test" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await updateOrderCustomerDetails(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
