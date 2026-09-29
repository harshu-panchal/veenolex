import { jest } from "@jest/globals";
import { mockExportsOf } from "./setup/mockExports.js";

const mockOrderFind = jest.fn();
const mockOrderCountDocuments = jest.fn();
const mockDeliveryFindById = jest.fn();
const mockSellerFind = jest.fn();
const mockDistanceMeters = jest.fn();

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: {
    find: mockOrderFind,
    countDocuments: mockOrderCountDocuments,
  },
}));

jest.unstable_mockModule("../app/models/delivery.js", () => ({
  default: {
    findById: mockDeliveryFindById,
  },
}));

jest.unstable_mockModule("../app/models/seller.js", () => ({
  default: {
    find: mockSellerFind,
  },
}));

jest.unstable_mockModule("../app/utils/geoUtils.js", () => ({
  distanceMeters: mockDistanceMeters,
}));

jest.unstable_mockModule("../app/models/sellerProductRequest.js", () => ({
  default: {
    find: jest.fn(() => ({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    })),
  },
}));

// No warehouse configured: only seller orders are in play.
jest.unstable_mockModule("../app/services/fulfillmentRoutingService.js", () =>
  mockExportsOf("app/services/fulfillmentRoutingService.js", {
    ADMIN_FULFILLER: "ADMIN",
    ROUTED_REASON: {},
    getFulfillmentWarehouse: jest.fn().mockResolvedValue({ hasLocation: false }),
  }));

const {
  buildSellerOrdersQuery,
  fetchAvailableOrdersForDelivery,
} = await import("../app/services/orderQueryService.js");

function makeOrderQueryChain(result) {
  return {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  };
}

function makeSelectChain(result) {
  return {
    select: jest.fn().mockResolvedValue(result),
  };
}

describe("orderQueryService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("buildSellerOrdersQuery maps sidebar status values and date range", () => {
    // Admin viewing one seller: the requested range is used as-is (sellers
    // themselves are limited to the last 40 days, covered below).
    const { finalQuery: query } = buildSellerOrdersQuery({
      role: "admin",
      sellerId: "seller-1",
      statusParam: "processed",
      startDate: "2026-03-01",
      endDate: "2026-03-29",
    });

    expect(query.seller).toBe("seller-1");
    // "Processed" covers legacy statuses and the v2 workflow states.
    expect(query.$or).toEqual([
      { status: { $in: ["confirmed", "packed"] } },
      { workflowStatus: { $in: ["SELLER_ACCEPTED", "DELIVERY_SEARCH", "DELIVERY_ASSIGNED", "PICKUP_READY"] } },
    ]);
    expect(query.createdAt.$gte).toEqual(new Date("2026-03-01"));
    expect(query.createdAt.$lte.getFullYear()).toBe(2026);
    expect(query.createdAt.$lte.getMonth()).toBe(2);
    expect(query.createdAt.$lte.getDate()).toBe(29);
    expect(query.createdAt.$lte.getHours()).toBe(23);
    expect(query.createdAt.$lte.getMinutes()).toBe(59);
    expect(query.createdAt.$lte.getSeconds()).toBe(59);
    expect(query.createdAt.$lte.getMilliseconds()).toBe(999);
  });

  test("buildSellerOrdersQuery limits sellers to their own last 40 days", () => {
    const { finalQuery } = buildSellerOrdersQuery({
      role: "seller",
      userId: "seller-1",
      startDate: "2020-01-01",
    });
    const fortyDaysAgo = new Date();
    fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);
    fortyDaysAgo.setHours(0, 0, 0, 0);

    expect(finalQuery.seller).toBe("seller-1");
    expect(finalQuery.createdAt.$gte).toEqual(fortyDaysAgo);
  });

  test("fetchAvailableOrdersForDelivery returns requiresLocation when rider has no coordinates", async () => {
    mockDeliveryFindById.mockResolvedValue({
      _id: "rider-1",
      location: null,
    });

    const result = await fetchAvailableOrdersForDelivery({
      userId: "rider-1",
      requestedLimit: "15",
    });

    expect(result.requiresLocation).toBe(true);
    expect(result.orders).toEqual([]);
    expect(mockOrderFind).not.toHaveBeenCalled();
  });

  test("fetchAvailableOrdersForDelivery filters V2 orders by effective search radius and merges with legacy", async () => {
    mockDeliveryFindById.mockResolvedValue({
      _id: "rider-1",
      location: {
        type: "Point",
        coordinates: [77.59, 12.97],
      },
    });

    mockSellerFind.mockReturnValueOnce(
      makeSelectChain([{ _id: "seller-1" }, { _id: "seller-2" }]),
    );

    mockOrderFind.mockImplementation((query) => {
      if (query.workflowStatus) {
        return makeOrderQueryChain([
          {
            orderId: "ORD-1",
            deliverySearchMeta: { radiusMeters: 5000 },
            seller: { location: { coordinates: [77.591, 12.971] }, serviceRadius: 5 },
          },
          {
            orderId: "ORD-2",
            deliverySearchMeta: { radiusMeters: 5000 },
            seller: { location: { coordinates: [77.8, 13.2] }, serviceRadius: 1 },
          },
        ]);
      }
      return makeOrderQueryChain([
        {
          orderId: "ORD-3",
          seller: { location: { coordinates: [77.592, 12.972] } },
        },
      ]);
    });

    mockDistanceMeters
      .mockReturnValueOnce(300)
      .mockReturnValueOnce(4000);

    const result = await fetchAvailableOrdersForDelivery({
      userId: "rider-1",
      requestedLimit: "10",
    });

    expect(result.requiresLocation).toBe(false);
    expect(result.orders.map((order) => order.orderId)).toEqual(["ORD-1", "ORD-3"]);
  });
});
