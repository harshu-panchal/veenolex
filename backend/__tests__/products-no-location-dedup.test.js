import { jest } from "@jest/globals";

/**
 * Regression cover for the storefront showing a different catalogue to any
 * visitor without a location (a fresh or incognito session, where nothing is
 * cached in localStorage).
 *
 * Allowing location-less browsing skipped the whole location block, and with
 * it the main-catalog rule that collapses seller clones into one card per
 * admin master product. The result: 34 products instead of 7, with every
 * seller's clone listed separately under that seller's shop name. Collapsing
 * clones is not a location decision — only the "nearby" narrowing is — so it
 * has to happen with or without coordinates.
 */

const mockFind = jest.fn();
const mockCountDocuments = jest.fn().mockResolvedValue(0);
const mockGetNearbySellerIdsForCustomer = jest.fn().mockResolvedValue([]);

function makeQuery(items) {
  const query = {
    select: () => query,
    sort: () => query,
    skip: () => query,
    limit: () => query,
    lean: async () => items,
  };
  return query;
}

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: { find: mockFind, countDocuments: mockCountDocuments },
}));

jest.unstable_mockModule("../app/models/sellerInventory.js", () => ({ default: {} }));

jest.unstable_mockModule("../app/services/customerVisibilityService.js", () => ({
  parseCustomerCoordinates: ({ lat, lng } = {}) => {
    const latN = Number(lat);
    const lngN = Number(lng);
    const valid =
      lat !== undefined && lng !== undefined && Number.isFinite(latN) && Number.isFinite(lngN);
    return { valid, lat: valid ? latN : null, lng: valid ? lngN : null };
  },
  getNearbySellerIdsForCustomer: mockGetNearbySellerIdsForCustomer,
}));

jest.unstable_mockModule("../app/services/fulfillmentRoutingService.js", () => ({
  annotateMasterAvailability: (p) => p,
  getFulfillmentWarehouse: jest.fn().mockResolvedValue({ hasLocation: false }),
}));

jest.unstable_mockModule("../app/services/deliveryEtaService.js", () => ({
  productDeliveryEstimate: () => ({ minMinutes: 30, maxMinutes: 120 }),
}));

jest.unstable_mockModule("../app/services/searchSyncService.js", () => ({
  enqueueProductIndex: jest.fn(),
  enqueueProductRemoval: jest.fn(),
}));

jest.unstable_mockModule("../app/services/cacheService.js", () => ({
  buildKey: (...parts) => parts.join(":"),
  getOrSet: async (_key, fetchFn) => fetchFn(),
  getTTL: () => 60,
  invalidate: jest.fn(),
}));

jest.unstable_mockModule("../app/services/mediaService.js", () => ({
  uploadToCloudinary: jest.fn(),
}));

jest.unstable_mockModule("../app/services/stockService.js", () => ({
  broadcastProductStock: jest.fn(),
}));

jest.unstable_mockModule("../app/services/logger.js", () => ({
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.unstable_mockModule("../app/utils/geoUtils.js", () => ({ distanceMeters: () => 0 }));

jest.unstable_mockModule("../app/services/entityNameCache.js", () => ({
  resolveCategoryName: jest.fn().mockResolvedValue("Cat"),
  resolveSellerName: jest.fn().mockResolvedValue("Some Shop"),
}));

jest.unstable_mockModule("../app/services/productModerationService.js", () => ({
  PRODUCT_APPROVAL_STATUS: { APPROVED: "approved" },
  getProductApprovalConfig: jest.fn(),
  getApprovedOrLegacyFilter: () => ({ approvalStatus: "approved" }),
  buildApprovalStatusFilter: () => ({}),
  normalizeProductModerationFields: (p) => p,
  sanitizeApprovalNote: (n) => n,
  resolveProductApprovalStatus: () => "approved",
}));

const { getProducts } = await import("../app/controller/productController.js");

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

/** The $or clause the controller handed to Product.find, if any. */
function capturedOrClause() {
  const filter = mockFind.mock.calls[0][0];
  const flat = filter.$and ? Object.assign({}, ...filter.$and) : filter;
  return flat.$or;
}

describe("getProducts catalogue shape without a location", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFind.mockReturnValue(makeQuery([]));
    mockCountDocuments.mockResolvedValue(0);
  });

  test("a customer with no coordinates still gets one card per product, not every seller clone", async () => {
    const req = { query: { limit: "100" }, user: null };
    const res = mockRes();

    await getProducts(req, res);

    expect(res.statusCode).toBe(200);
    const or = capturedOrClause();
    expect(or).toEqual([
      { sellerId: null },
      { sellerId: { $ne: null }, adminProductId: null },
    ]);
    // Every branch excludes clones of an admin master.
    for (const branch of or) {
      if (branch.sellerId !== null) expect(branch.adminProductId).toBeNull();
    }
    expect(res.body.result.locationFiltered).toBe(false);
  });

  test("a customer with coordinates keeps the nearby-narrowed catalogue", async () => {
    mockGetNearbySellerIdsForCustomer.mockResolvedValueOnce(["seller-1"]);
    const req = { query: { lat: "24.88", lng: "74.62" }, user: null };
    const res = mockRes();

    await getProducts(req, res);

    const or = capturedOrClause();
    expect(or).toContainEqual({ sellerId: null });
    expect(or).toContainEqual({ sellerId: { $in: ["seller-1"] }, adminProductId: null });
    expect(res.body.result.locationFiltered).toBe(true);
  });

  test("browsing one store without a location is not collapsed to the main catalogue", async () => {
    const req = { query: { sellerId: "seller-7" }, user: null };
    const res = mockRes();

    await getProducts(req, res);

    const filter = mockFind.mock.calls[0][0];
    const flat = filter.$and ? Object.assign({}, ...filter.$and) : filter;
    expect(flat.$or).toBeUndefined();
    expect(flat.sellerId).toBe("seller-7");
  });

  test("admin listings are untouched and still see seller clones", async () => {
    const req = { query: { limit: "100" }, user: { id: "admin-1", role: "admin" } };
    const res = mockRes();

    await getProducts(req, res);

    const filter = mockFind.mock.calls[0][0];
    const flat = filter.$and ? Object.assign({}, ...filter.$and) : filter;
    expect(flat.$or).toBeUndefined();
  });
});
