import { jest } from "@jest/globals";

const ADMIN_PRODUCT = "64b000000000000000000001";
const SELLER_PRODUCT = "64b000000000000000000002";
const SELLER_ID = "64b0000000000000000000aa";
const VARIANT_ID = "64b0000000000000000000v1";

const products = {
  [ADMIN_PRODUCT]: {
    _id: ADMIN_PRODUCT,
    name: "Shampoo",
    sellerId: null,
    stock: 6,
    variants: [{ _id: VARIANT_ID, name: "200ml", sku: "SH-200", stock: 6 }],
  },
  [SELLER_PRODUCT]: { _id: SELLER_PRODUCT, name: "Hair Oil", sellerId: SELLER_ID, stock: 4, variants: [] },
};

const mockDecrement = jest.fn(async ({ productId, quantity }) => {
  const p = products[productId];
  const updated = { ...p, stock: p.stock - quantity, variants: p.variants.map((v) => ({ ...v, stock: v.stock - quantity })) };
  return { product: updated };
});
const mockAssertAvailable = jest.fn(async () => ({ available: 6 }));
const mockIncrement = jest.fn(async () => ({ product: null }));
const savedOrders = [];
const mockFindOneAndUpdate = jest.fn();

class MockOrder {
  constructor(data) { Object.assign(this, data); this._id = "order-1"; }
  async save() { savedOrders.push(this); return this; }
  static findOneAndUpdate(...args) { return mockFindOneAndUpdate(...args); }
}

jest.unstable_mockModule("../app/models/order.js", () => ({ default: MockOrder }));
jest.unstable_mockModule("../app/models/product.js", () => ({
  default: {
    findById: (id) => ({ session: () => ({ lean: async () => products[String(id)] || null }) }),
  },
}));
jest.unstable_mockModule("../app/models/customer.js", () => ({ default: { findByIdAndUpdate: jest.fn() } }));
jest.unstable_mockModule("../app/models/creditTransaction.js", () => ({ default: { create: jest.fn() } }));
jest.unstable_mockModule("../app/services/orderIdService.js", () => ({
  generateUniquePublicOrderId: jest.fn(async () => "ORD-TEST"),
}));
jest.unstable_mockModule("../app/services/stockService.js", () => ({
  invalidateProductStockCache: jest.fn(async () => {}),
}));
jest.unstable_mockModule("../app/services/pos/walkInCustomerService.js", () => ({
  resolvePOSCustomer: jest.fn(async () => ({ _id: "cust-1", name: "Walk-in", phone: "0000000000" })),
  isWalkInCustomer: (id) => id === "walk-in-customer",
}));
jest.unstable_mockModule("../app/services/pos/variantStockService.js", () => ({
  decrementVariantStock: mockDecrement,
  incrementVariantStock: mockIncrement,
  assertVariantStockAvailable: mockAssertAvailable,
}));

const mongoose = (await import("mongoose")).default;
const { createPOSOrder, deductPOSOrderStockOnce, wasPOSStockDeducted } = await import(
  "../app/services/pos/posOrderService.js"
);
const { effectiveStock } = await import("../app/services/pos/variantHelpers.js");

const adminCashBill = (items) =>
  createPOSOrder({
    customerId: "walk-in-customer",
    paymentMethod: "Cash",
    paymentStatus: "Paid",
    items,
    adminNotes: "Created via POS System",
    sellerId: null,
  });

describe("POS stock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    savedOrders.length = 0;
    jest.spyOn(mongoose, "startSession").mockResolvedValue({
      withTransaction: async (fn) => fn(),
      endSession: async () => {},
    });
  });

  it("deducts the sold quantity and returns the stock left", async () => {
    const { order, stockUpdates } = await adminCashBill([
      { productId: ADMIN_PRODUCT, variationId: VARIANT_ID, quantity: 6, price: 100, name: "Shampoo — 200ml" },
    ]);

    expect(mockDecrement).toHaveBeenCalledWith(
      expect.objectContaining({ productId: ADMIN_PRODUCT, variantId: VARIANT_ID, quantity: 6, source: "POS" }),
    );
    expect(stockUpdates).toEqual([expect.objectContaining({ productId: ADMIN_PRODUCT, remaining: 0 })]);
    expect(order.posStockDeductedAt).toBeInstanceOf(Date);
    expect(order.items[0]).toEqual(expect.objectContaining({ variantId: VARIANT_ID, stockTracked: true }));
  });

  it("does not touch stock for quick-add custom items", async () => {
    await adminCashBill([{ productId: "custom-1", quantity: 2, price: 50, name: "Carry bag" }]);
    expect(mockDecrement).not.toHaveBeenCalled();
  });

  it("only checks stock for an unpaid online bill", async () => {
    const { order, stockUpdates } = await createPOSOrder({
      customerId: "walk-in-customer",
      paymentMethod: "Online",
      paymentStatus: "Pending",
      items: [{ productId: ADMIN_PRODUCT, quantity: 2, price: 100, name: "Shampoo" }],
      adminNotes: "Created via POS System (Online Payment)",
      sellerId: null,
    });

    expect(mockAssertAvailable).toHaveBeenCalledWith(expect.objectContaining({ productId: ADMIN_PRODUCT, quantity: 2 }));
    expect(mockDecrement).not.toHaveBeenCalled();
    expect(stockUpdates).toEqual([]);
    expect(order.posStockDeductedAt).toBeNull();
    expect(wasPOSStockDeducted(order)).toBe(false);
  });

  it("refuses to sell another store's product", async () => {
    await expect(
      adminCashBill([{ productId: SELLER_PRODUCT, quantity: 1, price: 10, name: "Hair Oil" }]),
    ).rejects.toThrow("not in this store's catalog");
    expect(mockDecrement).not.toHaveBeenCalled();
    expect(savedOrders).toHaveLength(0);
  });

  it("rejects zero or fractional quantities", async () => {
    await expect(
      adminCashBill([{ productId: ADMIN_PRODUCT, quantity: 0, price: 10 }]),
    ).rejects.toThrow("Invalid quantity");
    await expect(
      adminCashBill([{ productId: ADMIN_PRODUCT, quantity: 1.5, price: 10 }]),
    ).rejects.toThrow("Invalid quantity");
  });

  it("deducts an online bill once, when the payment is verified", async () => {
    mockFindOneAndUpdate.mockResolvedValueOnce({
      _id: "order-1",
      orderId: "ORD-TEST",
      seller: null,
      items: [
        { product: ADMIN_PRODUCT, variantId: VARIANT_ID, quantity: 2, name: "Shampoo", stockTracked: true },
        { product: "64b0000000000000000000ff", quantity: 1, name: "Carry bag", stockTracked: false },
      ],
    });
    const first = await deductPOSOrderStockOnce("order-1");
    expect(mockDecrement).toHaveBeenCalledTimes(1);
    expect(first.stockError).toBeNull();

    // Second verify: already claimed, nothing deducted again.
    mockFindOneAndUpdate.mockResolvedValueOnce(null);
    const second = await deductPOSOrderStockOnce("order-1");
    expect(mockDecrement).toHaveBeenCalledTimes(1);
    expect(second.stockUpdates).toEqual([]);
  });

  it("reports a stock shortfall at payment time instead of failing the payment", async () => {
    mockFindOneAndUpdate.mockResolvedValueOnce({
      _id: "order-1",
      orderId: "ORD-TEST",
      items: [{ product: ADMIN_PRODUCT, variantId: VARIANT_ID, quantity: 9, name: "Shampoo", stockTracked: true }],
    });
    mockDecrement.mockRejectedValueOnce(Object.assign(new Error("Only 6 left of Shampoo"), { code: "INSUFFICIENT_STOCK" }));

    const result = await deductPOSOrderStockOnce("order-1");
    expect(result).toEqual({ stockUpdates: [], stockError: "Only 6 left of Shampoo" });
  });

  it("treats bills from before stock tracking as already deducted", () => {
    expect(wasPOSStockDeducted({ posStockVersion: null })).toBe(true);
    expect(wasPOSStockDeducted({ posStockVersion: 2, posStockDeductedAt: null })).toBe(false);
  });

  it("sellable stock is the smaller of product and variant stock", () => {
    expect(effectiveStock({ stock: 0 }, { stock: 90 })).toBe(0);
    expect(effectiveStock({ stock: 97 }, { stock: 96 })).toBe(96);
    expect(effectiveStock({ stock: 5 }, null)).toBe(5);
  });
});
