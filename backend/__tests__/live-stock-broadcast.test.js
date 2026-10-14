import { jest } from "@jest/globals";

const ADMIN_PRODUCT = "64b000000000000000000001";
const SELLER_PRODUCT = "64b000000000000000000002";
const OTHER_SELLER_PRODUCT = "64b000000000000000000003";
const SELLER_A = "64b0000000000000000000aa";
const SELLER_B = "64b0000000000000000000bb";

const rows = [
  {
    _id: ADMIN_PRODUCT,
    name: "Sea Buckthorn Juice",
    sellerId: null,
    stock: 64,
    variants: [{ _id: "v1", sku: "seabu-001", name: "500ml", stock: 64 }],
  },
  { _id: SELLER_PRODUCT, name: "Hair Oil", sellerId: SELLER_A, stock: 3, variants: [] },
  { _id: OTHER_SELLER_PRODUCT, name: "Soap", sellerId: SELLER_B, stock: 9, variants: [] },
];

const mockFind = jest.fn(() => ({
  select: () => ({ lean: async () => rows }),
}));
const mockInvalidate = jest.fn(async () => {});
const mockEmitToAllAdmins = jest.fn();
const mockEmitToSeller = jest.fn();

jest.unstable_mockModule("../app/models/product.js", () => ({ default: { find: mockFind } }));
jest.unstable_mockModule("../app/models/stockHistory.js", () => ({ default: { create: jest.fn() } }));
jest.unstable_mockModule("../app/services/lowStockAlertService.js", () => ({
  createLowStockAlertCandidate: jest.fn(),
}));
jest.unstable_mockModule("../app/services/cacheService.js", () => ({
  buildKey: (...parts) => parts.join(":"),
  invalidate: mockInvalidate,
}));
jest.unstable_mockModule("../app/services/logger.js", () => ({
  default: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));
jest.unstable_mockModule("../app/services/orderSocketEmitter.js", () => ({
  emitToAllAdmins: mockEmitToAllAdmins,
  emitToSeller: mockEmitToSeller,
}));

const { invalidateProductStockCache, broadcastProductStock } = await import(
  "../app/services/stockService.js"
);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("live product stock broadcast", () => {
  test("admins get every changed product with fresh stock", async () => {
    await broadcastProductStock([ADMIN_PRODUCT, SELLER_PRODUCT, OTHER_SELLER_PRODUCT]);

    expect(mockEmitToAllAdmins).toHaveBeenCalledTimes(1);
    const { event, payload } = mockEmitToAllAdmins.mock.calls[0][0];
    expect(event).toBe("product:stock");
    expect(payload.updates).toHaveLength(3);
    expect(payload.updates[0]).toMatchObject({
      productId: ADMIN_PRODUCT,
      stock: 64,
      sellerId: null,
      variants: [{ _id: "v1", sku: "seabu-001", stock: 64 }],
    });
  });

  test("each seller only gets their own products", async () => {
    await broadcastProductStock([ADMIN_PRODUCT, SELLER_PRODUCT, OTHER_SELLER_PRODUCT]);

    expect(mockEmitToSeller).toHaveBeenCalledTimes(2);
    const bySeller = Object.fromEntries(
      mockEmitToSeller.mock.calls.map(([sellerId, { payload }]) => [
        sellerId,
        payload.updates.map((u) => u.productId),
      ]),
    );
    expect(bySeller).toEqual({
      [SELLER_A]: [SELLER_PRODUCT],
      [SELLER_B]: [OTHER_SELLER_PRODUCT],
    });
  });

  test("cache invalidation after a sale also pushes the new stock", async () => {
    await invalidateProductStockCache([ADMIN_PRODUCT, ADMIN_PRODUCT, null]);

    expect(mockInvalidate).toHaveBeenCalledWith(`catalog:product:${ADMIN_PRODUCT}`);
    expect(mockFind).toHaveBeenCalledWith({ _id: { $in: [ADMIN_PRODUCT] } });
    expect(mockEmitToAllAdmins).toHaveBeenCalledTimes(1);
  });

  test("nothing is sent for an empty change and errors never throw", async () => {
    await broadcastProductStock([]);
    expect(mockFind).not.toHaveBeenCalled();

    mockFind.mockImplementationOnce(() => {
      throw new Error("db down");
    });
    await expect(broadcastProductStock([ADMIN_PRODUCT])).resolves.toBeUndefined();
    expect(mockEmitToAllAdmins).not.toHaveBeenCalled();
  });
});
