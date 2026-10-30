import { jest } from "@jest/globals";

/**
 * Regression cover for the storefront's home page being empty without a
 * location: `/offer-sections` 400'd for any customer who had not granted
 * location, so OfferSections.jsx silently got nothing to render (its own
 * fetch is wrapped in `.catch(() => ({ data: {} }))`), the same way
 * `/products` used to. Browsing must work with or without coordinates;
 * only the "nearby seller" narrowing needs a location to mean anything.
 */

const mockOfferSectionFind = jest.fn();
const mockProductFind = jest.fn();
const mockGetNearbySellerIdsForCustomer = jest.fn();

jest.unstable_mockModule("../app/models/offerSection.js", () => ({
  default: { find: mockOfferSectionFind },
}));

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: { find: mockProductFind },
}));

jest.unstable_mockModule("../app/services/customerVisibilityService.js", () => ({
  parseCustomerCoordinates: ({ lat, lng } = {}) => {
    const latN = Number(lat);
    const lngN = Number(lng);
    const valid = Number.isFinite(latN) && Number.isFinite(lngN);
    return { valid, lat: latN, lng: lngN };
  },
  getNearbySellerIdsForCustomer: mockGetNearbySellerIdsForCustomer,
}));

jest.unstable_mockModule("../app/services/cacheService.js", () => ({
  buildKey: (...parts) => parts.join(":"),
  // Bypass the cache entirely: always call through to fetchFn.
  getOrSet: async (_key, fetchFn) => fetchFn(),
  getTTL: () => 60,
  delPattern: jest.fn().mockResolvedValue(0),
}));

jest.unstable_mockModule("../app/services/productModerationService.js", () => ({
  getApprovedOrLegacyFilter: () => ({}),
}));

const { getPublicOfferSections } = await import(
  "../app/controller/offerSectionController.js"
);

function makeQuery(items) {
  // Chainable mongoose-query stub: .sort().populate().populate()... .lean()
  const query = {
    sort: () => query,
    populate: () => query,
    select: () => query,
    limit: () => query,
    lean: async () => items,
  };
  return query;
}

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

describe("getPublicOfferSections without a customer location", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 200 with unfiltered sections instead of 400", async () => {
    mockOfferSectionFind.mockReturnValue(
      makeQuery([
        {
          _id: "sec-1",
          title: "Manual Picks",
          isAutomatic: false,
          sellerIds: [{ _id: "seller-1" }, { _id: "seller-2" }],
          productIds: [
            { _id: "p1", sellerId: { _id: "seller-1" } },
            { _id: "p2", sellerId: { _id: "seller-2" } },
          ],
        },
      ]),
    );

    const res = mockRes();
    await getPublicOfferSections({ query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    // No location means no "nearby" narrowing: every configured seller and
    // product in the section comes through as-is.
    const section = res.body.results[0];
    expect(section.sellerIds).toHaveLength(2);
    expect(section.productIds).toHaveLength(2);
    // Zone computation must not even run without coordinates.
    expect(mockGetNearbySellerIdsForCustomer).not.toHaveBeenCalled();
  });

  test("automatic sections return no products without a location, not an error", async () => {
    mockOfferSectionFind.mockReturnValue(
      makeQuery([
        {
          _id: "sec-auto",
          title: "Top Selling",
          isAutomatic: true,
          sellerIds: [],
          productIds: [],
        },
      ]),
    );

    const res = mockRes();
    await getPublicOfferSections({ query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.results[0].productIds).toEqual([]);
    expect(mockProductFind).not.toHaveBeenCalled();
  });

  test("preserves all admin-selected products for all customer locations", async () => {
    mockGetNearbySellerIdsForCustomer.mockResolvedValue(["seller-1"]);
    mockOfferSectionFind.mockReturnValue(
      makeQuery([
        {
          _id: "sec-1",
          title: "Manual Picks",
          isAutomatic: false,
          sellerIds: [{ _id: "seller-1" }, { _id: "seller-2" }],
          productIds: [
            { _id: "p1", sellerId: { _id: "seller-1" } },
            { _id: "p2", sellerId: { _id: "seller-2" } },
            { _id: "p-admin", sellerId: null },
          ],
        },
      ]),
    );

    const res = mockRes();
    await getPublicOfferSections(
      { query: { lat: "22.7", lng: "75.8" } },
      res,
    );

    expect(res.statusCode).toBe(200);
    const section = res.body.results[0];
    expect(section.productIds).toHaveLength(3);
    expect(section.productIds.map((p) => p._id)).toEqual(["p1", "p2", "p-admin"]);
  });
});
