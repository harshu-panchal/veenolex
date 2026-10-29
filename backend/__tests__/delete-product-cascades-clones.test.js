import { jest } from "@jest/globals";

/**
 * Regression cover for deleting an admin master product orphaning every
 * seller's clone of it. `deleteProduct` used to remove only the targeted
 * document; any product with `adminProductId` pointing at it kept selling
 * with its master gone. Found live on `/products` (three orphaned "barcode"
 * test products, one still shown and purchasable to a customer after admin
 * deleted its master) and fixed by cascading the delete to clones.
 */

const mockFindOneAndDelete = jest.fn();
const mockFind = jest.fn();
const mockDeleteMany = jest.fn();
const mockEnqueueProductRemoval = jest.fn().mockResolvedValue(undefined);
const mockInvalidate = jest.fn().mockResolvedValue(undefined);

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: {
    findOneAndDelete: mockFindOneAndDelete,
    find: mockFind,
    deleteMany: mockDeleteMany,
  },
}));

jest.unstable_mockModule("../app/models/sellerInventory.js", () => ({ default: {} }));

jest.unstable_mockModule("../app/services/customerVisibilityService.js", () => ({
  parseCustomerCoordinates: () => ({ valid: false, lat: null, lng: null }),
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
  enqueueProductIndex: jest.fn().mockResolvedValue(undefined),
  enqueueProductRemoval: mockEnqueueProductRemoval,
}));

jest.unstable_mockModule("../app/services/cacheService.js", () => ({
  buildKey: (...parts) => parts.join(":"),
  getOrSet: async (_key, fetchFn) => fetchFn(),
  getTTL: () => 60,
  invalidate: mockInvalidate,
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

jest.unstable_mockModule("../app/utils/geoUtils.js", () => ({
  distanceMeters: () => 0,
}));

jest.unstable_mockModule("../app/services/entityNameCache.js", () => ({
  resolveCategoryName: jest.fn(),
  resolveSellerName: jest.fn(),
}));

jest.unstable_mockModule("../app/services/productModerationService.js", () => ({
  PRODUCT_APPROVAL_STATUS: { APPROVED: "approved", PENDING: "pending", REJECTED: "rejected" },
  getProductApprovalConfig: jest.fn(),
  getApprovedOrLegacyFilter: () => ({}),
  buildApprovalStatusFilter: () => ({}),
  normalizeProductModerationFields: (p) => p,
  sanitizeApprovalNote: (n) => n,
  resolveProductApprovalStatus: () => "approved",
}));

const { deleteProduct } = await import("../app/controller/productController.js");

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe("deleteProduct cascades to seller clones", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("admin deleting a master product also deletes every seller's clone of it", async () => {
    mockFindOneAndDelete.mockResolvedValueOnce({ _id: "master-1", name: "Rosemary Rice water" });
    mockFind.mockReturnValueOnce({
      select: () => ({
        lean: jest.fn().mockResolvedValue([{ _id: "clone-1" }, { _id: "clone-2" }]),
      }),
    });
    mockDeleteMany.mockResolvedValueOnce({ deletedCount: 2 });

    const req = { params: { id: "master-1" }, user: { id: "admin-1", role: "admin" } };
    const res = mockRes();

    await deleteProduct(req, res);

    expect(mockFind).toHaveBeenCalledWith({ adminProductId: "master-1" });
    expect(mockDeleteMany).toHaveBeenCalledWith({ _id: { $in: ["clone-1", "clone-2"] } });
    expect(mockEnqueueProductRemoval).toHaveBeenCalledWith("clone-1");
    expect(mockEnqueueProductRemoval).toHaveBeenCalledWith("clone-2");
    expect(mockEnqueueProductRemoval).toHaveBeenCalledWith("master-1");
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toContain("2 seller clones removed with it");
  });

  test("deleting a product with no clones does not touch unrelated products", async () => {
    mockFindOneAndDelete.mockResolvedValueOnce({ _id: "standalone-1" });
    mockFind.mockReturnValueOnce({
      select: () => ({ lean: jest.fn().mockResolvedValue([]) }),
    });

    const req = { params: { id: "standalone-1" }, user: { id: "seller-1", role: "seller" } };
    const res = mockRes();

    await deleteProduct(req, res);

    expect(mockFindOneAndDelete).toHaveBeenCalledWith({ _id: "standalone-1", sellerId: "seller-1" });
    expect(mockDeleteMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe("Product deleted successfully");
  });

  test("404s without touching anything when the product is missing or unauthorized", async () => {
    mockFindOneAndDelete.mockResolvedValueOnce(null);

    const req = { params: { id: "missing-1" }, user: { id: "seller-1", role: "seller" } };
    const res = mockRes();

    await deleteProduct(req, res);

    expect(mockFind).not.toHaveBeenCalled();
    expect(mockDeleteMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
