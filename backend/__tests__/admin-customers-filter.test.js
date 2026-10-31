import { jest } from "@jest/globals";

const mockAggregate = jest.fn();

jest.unstable_mockModule("../app/models/customer.js", () => ({
  default: {
    aggregate: mockAggregate,
  },
}));

jest.unstable_mockModule("../app/models/order.js", () => ({ default: {} }));
jest.unstable_mockModule("../app/models/wallet.js", () => ({ default: {} }));
jest.unstable_mockModule("../app/models/cart.js", () => ({ default: {} }));
jest.unstable_mockModule("../app/models/wishlist.js", () => ({ default: {} }));
jest.unstable_mockModule("../app/models/creditTransaction.js", () => ({ default: {} }));

const { getUsersData } = await import("../app/services/admin/userAdminService.js");
const { getUsers } = await import("../app/controller/admin/userController.js");

describe("Admin Customers Date and Location Filtering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("sorts by ascending joined date when dateSort is 'asc'", async () => {
    mockAggregate.mockResolvedValueOnce([
      {
        totalCount: [{ count: 1 }],
        items: [
          {
            id: "cust-1",
            name: "Rahul Sharma",
            joinedDate: new Date("2024-01-01"),
            totalOrders: 2,
          },
        ],
      },
    ]);

    const result = await getUsersData({
      page: 1,
      limit: 10,
      skip: 0,
      dateSort: "asc",
    });

    expect(mockAggregate).toHaveBeenCalled();
    const pipeline = mockAggregate.mock.calls[0][0];
    const sortStage = pipeline.find((stage) => stage.$sort);
    expect(sortStage).toEqual({ $sort: { joinedDate: 1 } });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  test("filters by location (e.g. Indore) matching order delivery addresses and customer location", async () => {
    mockAggregate.mockResolvedValueOnce([
      {
        totalCount: [{ count: 1 }],
        items: [
          {
            id: "cust-2",
            name: "Aman Verma",
            lastOrderAddress: { city: "Indore", address: "Vijay Nagar, Indore" },
            allOrderCities: ["Indore"],
          },
        ],
      },
    ]);

    const result = await getUsersData({
      page: 1,
      limit: 10,
      skip: 0,
      location: "Indore",
    });

    expect(mockAggregate).toHaveBeenCalled();
    const pipeline = mockAggregate.mock.calls[0][0];
    const locationMatchStage = pipeline.find(
      (stage) => stage.$match && stage.$match.$or && Array.isArray(stage.$match.$or),
    );
    expect(locationMatchStage).toBeDefined();

    // Verify regex matches "Indore" case-insensitively
    const orClauses = locationMatchStage.$match.$or;
    const hasOrderCityCheck = orClauses.some(
      (clause) => clause["allOrderCities"] && clause["allOrderCities"].test("Indore"),
    );
    expect(hasOrderCityCheck).toBe(true);
    expect(result.items[0].location.city).toBe("Indore");
  });

  test("handles date range presets like 'last_7_days'", async () => {
    mockAggregate.mockResolvedValueOnce([
      {
        totalCount: [{ count: 0 }],
        items: [],
      },
    ]);

    await getUsersData({
      page: 1,
      limit: 10,
      skip: 0,
      dateRange: "last_7_days",
    });

    expect(mockAggregate).toHaveBeenCalled();
    const pipeline = mockAggregate.mock.calls[0][0];
    const initialMatch = pipeline[0].$match;
    expect(initialMatch.createdAt).toBeDefined();
    expect(initialMatch.createdAt.$gte).toBeInstanceOf(Date);
    expect(initialMatch.createdAt.$lte).toBeInstanceOf(Date);
  });

  test("getUsers controller forwards dateSort and location query parameters", async () => {
    mockAggregate.mockResolvedValueOnce([
      {
        totalCount: [{ count: 1 }],
        items: [{ id: "cust-3", name: "Pooja" }],
      },
    ]);

    const req = {
      query: {
        page: "1",
        limit: "25",
        dateSort: "asc",
        location: "Indore",
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await getUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.success).toBe(true);
    expect(responseBody.result.items).toHaveLength(1);

    const pipeline = mockAggregate.mock.calls[0][0];
    const sortStage = pipeline.find((stage) => stage.$sort);
    expect(sortStage).toEqual({ $sort: { joinedDate: 1 } });
  });
});

