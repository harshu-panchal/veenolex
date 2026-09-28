import { jest } from "@jest/globals";

const mockProductFind = jest.fn();
const mockGetNearbySellerIds = jest.fn();

function queryChain(result) {
  const chain = {
    select: jest.fn(() => chain),
    session: jest.fn(() => chain),
    lean: jest.fn().mockResolvedValue(result),
  };
  return chain;
}

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: { find: mockProductFind },
}));

jest.unstable_mockModule("../app/models/setting.js", () => ({
  default: { findOne: jest.fn(() => queryChain(null)) },
}));

jest.unstable_mockModule("../app/models/admin.js", () => ({
  default: { find: jest.fn(() => ({ select: () => ({ sort: () => ({ lean: async () => [] }) }) })) },
}));

jest.unstable_mockModule("../app/services/customerVisibilityService.js", () => ({
  getNearbySellerIdsForCustomer: mockGetNearbySellerIds,
  parseCustomerCoordinates: jest.fn(),
}));

const { routeMasterLines, availableStockFor, ROUTED_REASON, ADMIN_FULFILLER } = await import(
  "../app/services/fulfillmentRoutingService.js"
);
const { hydrateOrderItems } = await import("../app/services/finance/pricingService.js");

const INDORE = { lat: 22.7196, lng: 75.8577 };
const MASTER_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const MASTER_B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const SELLER_NEAR = "111111111111111111111111";
const SELLER_FAR = "222222222222222222222222";

function clone(id, masterId, sellerId, stock, extra = {}) {
  return {
    _id: id,
    adminProductId: masterId,
    sellerId,
    stock,
    status: "active",
    approvalStatus: "approved",
    variants: [],
    ...extra,
  };
}

describe("routeMasterLines", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends everything to admin when no seller serves the customer's area", async () => {
    mockGetNearbySellerIds.mockResolvedValue([]);

    const routes = await routeMasterLines({
      lines: [{ masterId: MASTER_A, quantity: 1 }],
      customerLocation: INDORE,
    });

    expect(routes).toEqual([
      {
        fulfilledBy: ADMIN_FULFILLER,
        sellerId: null,
        productId: MASTER_A,
        reason: ROUTED_REASON.NO_LOCAL_SELLER,
      },
    ]);
    expect(mockProductFind).not.toHaveBeenCalled();
  });

  it("routes to the nearest local seller that has enough stock", async () => {
    mockGetNearbySellerIds.mockResolvedValue([SELLER_NEAR, SELLER_FAR]);
    mockProductFind.mockReturnValue(
      queryChain([
        clone("c-near", MASTER_A, SELLER_NEAR, 5),
        clone("c-far", MASTER_A, SELLER_FAR, 5),
      ]),
    );

    const [route] = await routeMasterLines({
      lines: [{ masterId: MASTER_A, quantity: 2 }],
      customerLocation: INDORE,
    });

    expect(route).toMatchObject({
      fulfilledBy: "SELLER",
      sellerId: SELLER_NEAR,
      productId: "c-near",
      reason: ROUTED_REASON.LOCAL_SELLER,
    });
  });

  it("skips a nearby seller without enough stock", async () => {
    mockGetNearbySellerIds.mockResolvedValue([SELLER_NEAR, SELLER_FAR]);
    mockProductFind.mockReturnValue(
      queryChain([
        clone("c-near", MASTER_A, SELLER_NEAR, 1),
        clone("c-far", MASTER_A, SELLER_FAR, 10),
      ]),
    );

    const [route] = await routeMasterLines({
      lines: [{ masterId: MASTER_A, quantity: 3 }],
      customerLocation: INDORE,
    });

    expect(route.sellerId).toBe(SELLER_FAR);
  });

  it("falls back to admin when local sellers are out of stock", async () => {
    mockGetNearbySellerIds.mockResolvedValue([SELLER_NEAR]);
    mockProductFind.mockReturnValue(queryChain([clone("c-near", MASTER_A, SELLER_NEAR, 0)]));

    const [route] = await routeMasterLines({
      lines: [{ masterId: MASTER_A, quantity: 1 }],
      customerLocation: INDORE,
    });

    expect(route).toMatchObject({
      fulfilledBy: ADMIN_FULFILLER,
      productId: MASTER_A,
      reason: ROUTED_REASON.LOCAL_SELLER_NO_STOCK,
    });
  });

  it("prefers one seller covering the whole cart over splitting it", async () => {
    mockGetNearbySellerIds.mockResolvedValue([SELLER_NEAR, SELLER_FAR]);
    mockProductFind.mockReturnValue(
      queryChain([
        clone("near-a", MASTER_A, SELLER_NEAR, 5),
        clone("far-a", MASTER_A, SELLER_FAR, 5),
        clone("far-b", MASTER_B, SELLER_FAR, 5),
      ]),
    );

    const routes = await routeMasterLines({
      lines: [
        { masterId: MASTER_A, quantity: 1 },
        { masterId: MASTER_B, quantity: 1 },
      ],
      customerLocation: INDORE,
    });

    expect(routes.map((r) => r.sellerId)).toEqual([SELLER_FAR, SELLER_FAR]);
  });

  it("splits the cart between a local seller and admin when needed", async () => {
    mockGetNearbySellerIds.mockResolvedValue([SELLER_NEAR]);
    mockProductFind.mockReturnValue(queryChain([clone("near-a", MASTER_A, SELLER_NEAR, 5)]));

    const routes = await routeMasterLines({
      lines: [
        { masterId: MASTER_A, quantity: 1 },
        { masterId: MASTER_B, quantity: 1 },
      ],
      customerLocation: INDORE,
    });

    expect(routes[0]).toMatchObject({ fulfilledBy: "SELLER", sellerId: SELLER_NEAR });
    expect(routes[1]).toMatchObject({ fulfilledBy: ADMIN_FULFILLER, productId: MASTER_B });
  });

  it("never picks an excluded (already rejected) seller when rerouting", async () => {
    mockGetNearbySellerIds.mockResolvedValue([SELLER_NEAR, SELLER_FAR]);
    mockProductFind.mockReturnValue(queryChain([clone("c-far", MASTER_A, SELLER_FAR, 5)]));

    const routes = await routeMasterLines({
      lines: [{ masterId: MASTER_A, quantity: 1 }],
      customerLocation: INDORE,
      excludeSellerIds: [SELLER_NEAR],
      requireSingleSeller: true,
    });

    expect(routes[0].sellerId).toBe(SELLER_FAR);
    const cloneQuery = mockProductFind.mock.calls[0][0];
    expect(cloneQuery.sellerId.$in).toEqual([SELLER_FAR]);
  });

  it("with requireSingleSeller, goes to admin unless one seller has everything", async () => {
    mockGetNearbySellerIds.mockResolvedValue([SELLER_NEAR]);
    mockProductFind.mockReturnValue(queryChain([clone("near-a", MASTER_A, SELLER_NEAR, 5)]));

    const routes = await routeMasterLines({
      lines: [
        { masterId: MASTER_A, quantity: 1 },
        { masterId: MASTER_B, quantity: 1 },
      ],
      customerLocation: INDORE,
      requireSingleSeller: true,
    });

    expect(routes.every((r) => r.fulfilledBy === ADMIN_FULFILLER)).toBe(true);
  });

  it("checks variant stock, not just the product total", async () => {
    mockGetNearbySellerIds.mockResolvedValue([SELLER_NEAR]);
    mockProductFind.mockReturnValue(
      queryChain([
        clone("near-a", MASTER_A, SELLER_NEAR, 50, {
          variants: [
            { sku: "1KG", stock: 0 },
            { sku: "500G", stock: 50 },
          ],
        }),
      ]),
    );

    const [route] = await routeMasterLines({
      lines: [{ masterId: MASTER_A, variantSku: "1KG", quantity: 1 }],
      customerLocation: INDORE,
    });

    expect(route.fulfilledBy).toBe(ADMIN_FULFILLER);
  });
});

describe("hydrateOrderItems with fulfilment routing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("prices from the admin master's sale price even when a seller clone is ordered", async () => {
    const master = {
      _id: MASTER_A,
      name: "Basmati Rice",
      price: 200,
      salePrice: 180,
      sellerId: null,
      status: "active",
      approvalStatus: "approved",
      variants: [],
    };
    const sellerClone = clone("near-a", MASTER_A, SELLER_NEAR, 5, {
      name: "Basmati Rice",
      price: 250,
      salePrice: 240,
    });

    mockGetNearbySellerIds.mockResolvedValue([SELLER_NEAR]);
    mockProductFind
      .mockReturnValueOnce(queryChain([sellerClone])) // cart products
      .mockReturnValueOnce(queryChain([master])) // masters of clones
      .mockReturnValueOnce(queryChain([sellerClone])); // routing lookup

    const [line] = await hydrateOrderItems([{ product: "near-a", quantity: 2 }], {
      routeFulfillment: true,
      customerLocation: INDORE,
    });

    expect(line).toMatchObject({
      productId: "near-a",
      masterProductId: MASTER_A,
      sellerId: SELLER_NEAR,
      fulfilledBy: "SELLER",
      price: 180,
      quantity: 2,
    });
  });

  it("marks admin-catalog lines as ADMIN when no local seller can supply them", async () => {
    const master = {
      _id: MASTER_A,
      name: "Basmati Rice",
      price: 200,
      salePrice: 0,
      sellerId: null,
      status: "active",
      approvalStatus: "approved",
      variants: [],
    };
    mockGetNearbySellerIds.mockResolvedValue([]);
    mockProductFind.mockReturnValueOnce(queryChain([master]));

    const [line] = await hydrateOrderItems([{ product: MASTER_A, quantity: 1 }], {
      routeFulfillment: true,
      customerLocation: INDORE,
    });

    expect(line).toMatchObject({
      productId: MASTER_A,
      sellerId: ADMIN_FULFILLER,
      fulfilledBy: ADMIN_FULFILLER,
      routedReason: ROUTED_REASON.NO_LOCAL_SELLER,
      price: 200,
      zoneOutDeliveryEnabled: true,
    });
  });

  it("leaves sellers' own products with their seller", async () => {
    const own = {
      _id: "own-1",
      name: "Homemade Pickle",
      price: 120,
      salePrice: 99,
      sellerId: SELLER_NEAR,
      status: "active",
      approvalStatus: "approved",
      variants: [],
    };
    mockProductFind.mockReturnValueOnce(queryChain([own]));

    const [line] = await hydrateOrderItems([{ product: "own-1", quantity: 1 }], {
      routeFulfillment: true,
      customerLocation: INDORE,
    });

    expect(line).toMatchObject({ sellerId: SELLER_NEAR, fulfilledBy: "SELLER", price: 99 });
    expect(mockGetNearbySellerIds).not.toHaveBeenCalled();
  });
});

describe("availableStockFor", () => {
  it("a variant can never sell more than the product-level stock the seller manages", () => {
    const drifted = { stock: -9, variants: [{ sku: "V1", stock: 84 }] };
    expect(availableStockFor(drifted, "V1")).toBe(0);
    expect(availableStockFor({ stock: 5, variants: [{ sku: "V1", stock: 84 }] }, "V1")).toBe(5);
    expect(availableStockFor({ stock: 50, variants: [{ sku: "V1", stock: 3 }] }, "V1")).toBe(3);
    expect(availableStockFor({ stock: -2 })).toBe(0);
  });
});
