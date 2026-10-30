import { jest } from "@jest/globals";

const mockRecommendationFind = jest.fn();
const mockRecommendationFindOne = jest.fn();
const mockRecommendationFindById = jest.fn();
const mockRecommendationFindByIdAndDelete = jest.fn();
const mockRecommendationCountDocuments = jest.fn();

class MockCheckoutRecommendationInstance {
  constructor(data) {
    Object.assign(this, data);
    this._id = "rec-123";
  }
  async save() {
    return this;
  }
}

MockCheckoutRecommendationInstance.find = mockRecommendationFind;
MockCheckoutRecommendationInstance.findOne = mockRecommendationFindOne;
MockCheckoutRecommendationInstance.findById = mockRecommendationFindById;
MockCheckoutRecommendationInstance.findByIdAndDelete = mockRecommendationFindByIdAndDelete;
MockCheckoutRecommendationInstance.countDocuments = mockRecommendationCountDocuments;

jest.unstable_mockModule("../app/models/checkoutRecommendation.js", () => ({
  default: MockCheckoutRecommendationInstance,
}));

const {
  getPublicCheckoutRecommendations,
  getAdminCheckoutRecommendations,
  createCheckoutRecommendation,
  updateCheckoutRecommendation,
  deleteCheckoutRecommendation,
} = await import("../app/controller/checkoutRecommendationController.js");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("Checkout Recommendations Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getPublicCheckoutRecommendations", () => {
    test("returns active products mapped with prices", async () => {
      const dummyList = [
        {
          _id: "rec-1",
          order: 0,
          status: "active",
          product: {
            _id: "prod-1",
            name: "Hair Shampoo",
            price: 380,
            salePrice: 350,
            status: "active",
          },
        },
        {
          _id: "rec-2",
          order: 1,
          status: "active",
          product: {
            _id: "prod-2",
            name: "Hair Oil",
            price: 210,
            status: "active",
          },
        },
      ];

      mockRecommendationFind.mockReturnValue({
        sort: () => ({
          populate: () => ({
            lean: async () => dummyList,
          }),
        }),
      });

      const req = {};
      const res = mockRes();

      await getPublicCheckoutRecommendations(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].results || res.json.mock.calls[0][0].result;
      expect(data).toHaveLength(2);
      expect(data[0].id).toBe("prod-1");
      expect(data[0].price).toBe(350);
      expect(data[0].originalPrice).toBe(380);
      expect(data[1].id).toBe("prod-2");
      expect(data[1].price).toBe(210);
    });
  });

  describe("createCheckoutRecommendation", () => {
    test("creates new recommendation successfully", async () => {
      mockRecommendationFindOne.mockResolvedValue(null);
      mockRecommendationFindById.mockReturnValue({
        populate: async () => ({
          _id: "rec-123",
          product: { _id: "prod-1", name: "Hair Shampoo" },
          order: 0,
        }),
      });

      const req = { body: { productId: "prod-1", order: 0 } };
      const res = mockRes();

      await createCheckoutRecommendation(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json.mock.calls[0][0].success).toBe(true);
    });

    test("returns 400 when product already added", async () => {
      mockRecommendationFindOne.mockResolvedValue({ _id: "existing-rec" });

      const req = { body: { productId: "prod-1" } };
      const res = mockRes();

      await createCheckoutRecommendation(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].message).toContain("already added");
    });

    test("returns 400 when productId is missing", async () => {
      const req = { body: {} };
      const res = mockRes();

      await createCheckoutRecommendation(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("deleteCheckoutRecommendation", () => {
    test("deletes recommendation successfully", async () => {
      mockRecommendationFindByIdAndDelete.mockResolvedValue({ _id: "rec-123" });

      const req = { params: { id: "rec-123" } };
      const res = mockRes();

      await deleteCheckoutRecommendation(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("returns 404 when entry does not exist", async () => {
      mockRecommendationFindByIdAndDelete.mockResolvedValue(null);

      const req = { params: { id: "rec-not-found" } };
      const res = mockRes();

      await deleteCheckoutRecommendation(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
