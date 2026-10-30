import { jest } from "@jest/globals";

const mockSettingFindOne = jest.fn();
const mockProductFind = jest.fn();

jest.unstable_mockModule("../app/models/setting.js", () => ({
  default: { findOne: mockSettingFindOne },
}));

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: { find: mockProductFind },
}));

jest.unstable_mockModule("../app/models/sellerInventory.js", () => ({ default: {} }));

jest.unstable_mockModule("../app/services/customerVisibilityService.js", () => ({
  parseCustomerCoordinates: () => ({ valid: false }),
  getNearbySellerIdsForCustomer: jest.fn().mockResolvedValue([]),
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

const { getComingSoonSection } = await import(
  "../app/controller/productController.js"
);

function makeQuery(items) {
  const query = {
    sort: () => query,
    populate: () => query,
    select: () => query,
    limit: () => query,
    lean: async () => items,
  };
  return query;
}

function makeSettingQuery(item) {
  const query = {
    select: () => query,
    lean: async () => item,
  };
  return query;
}

describe("getComingSoonSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns empty products list when comingSoonSection is disabled", async () => {
    mockSettingFindOne.mockReturnValue(
      makeSettingQuery({
        comingSoonSection: {
          enabled: false,
          title: "Coming Soon",
        },
      })
    );

    let status;
    let jsonBody;
    const res = {
      status: (s) => {
        status = s;
        return res;
      },
      json: (b) => {
        jsonBody = b;
        return res;
      },
    };

    await getComingSoonSection({}, res);

    expect(status).toBe(200);
    expect(jsonBody.success).toBe(true);
    expect(jsonBody.result.config.enabled).toBe(false);
    expect(jsonBody.result.products).toEqual([]);
    expect(mockProductFind).not.toHaveBeenCalled();
  });

  test("returns products when comingSoonSection is enabled", async () => {
    mockSettingFindOne.mockReturnValue(
      makeSettingQuery({
        comingSoonSection: {
          enabled: true,
          title: "Coming Soon",
          subtitle: "Upcoming beauty picks",
          backgroundColor: "#C084FC",
        },
      })
    );

    const dummyProducts = [
      {
        _id: "prod-cs-1",
        name: "New Herbal Serum",
        price: 499,
        status: "coming_soon",
      },
    ];

    mockProductFind.mockReturnValue(makeQuery(dummyProducts));

    let status;
    let jsonBody;
    const res = {
      status: (s) => {
        status = s;
        return res;
      },
      json: (b) => {
        jsonBody = b;
        return res;
      },
    };

    await getComingSoonSection({}, res);

    expect(status).toBe(200);
    expect(jsonBody.success).toBe(true);
    expect(jsonBody.result.config.enabled).toBe(true);
    expect(jsonBody.result.products).toHaveLength(1);
    expect(jsonBody.result.products[0].name).toBe("New Herbal Serum");
    expect(mockProductFind).toHaveBeenCalledWith(
      expect.objectContaining({ status: "coming_soon" })
    );
  });
});
