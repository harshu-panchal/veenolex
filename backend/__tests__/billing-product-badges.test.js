import { jest } from "@jest/globals";

const mockSettingFindOne = jest.fn();
const mockSettingFindOneAndUpdate = jest.fn();
const mockSettingCreate = jest.fn();
const mockInvalidate = jest.fn();

jest.unstable_mockModule("../app/models/setting.js", () => ({
  default: {
    findOne: mockSettingFindOne,
    findOneAndUpdate: mockSettingFindOneAndUpdate,
    create: mockSettingCreate,
  },
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

const { getPublicSettings, updateSettings } = await import(
  "../app/controller/settingsController.js"
);
const { getPlatformSettings, updatePlatformSettings } = await import(
  "../app/controller/admin/settingsController.js"
);

describe("Billing & Product Badges Dynamic Settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getPublicSettings", () => {
    it("returns freeDeliveryThreshold and returnPolicyDays with defaults when not set", async () => {
      mockSettingFindOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            appName: "Veenolex",
          }),
        }),
      });

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await getPublicSettings({}, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const result = res.json.mock.calls[0][0].result;
      expect(result.returnPolicyDays).toBe(7);
      expect(result.freeDeliveryThreshold).toBe(0);
    });

    it("returns customized freeDeliveryThreshold and returnPolicyDays when set in DB", async () => {
      mockSettingFindOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            appName: "Veenolex",
            freeDeliveryThreshold: 399,
            returnPolicyDays: 14,
          }),
        }),
      });

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await getPublicSettings({}, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const result = res.json.mock.calls[0][0].result;
      expect(result.freeDeliveryThreshold).toBe(399);
      expect(result.returnPolicyDays).toBe(14);
    });
  });

  describe("updatePlatformSettings", () => {
    it("updates platform settings with returnPolicyDays, freeDeliveryThreshold and invalidates cache", async () => {
      mockSettingFindOneAndUpdate.mockResolvedValue({
        toObject: () => ({
          freeDeliveryThreshold: 499,
          returnPolicyDays: 10,
          platformFee: 15,
        }),
      });

      const req = {
        body: {
          freeDeliveryThreshold: 499,
          returnPolicyDays: 10,
          platformFee: 15,
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await updatePlatformSettings(req, res);

      expect(mockSettingFindOneAndUpdate).toHaveBeenCalledWith(
        {},
        {
          $set: expect.objectContaining({
            freeDeliveryThreshold: 499,
            returnPolicyDays: 10,
            platformFee: 15,
          }),
        },
        { new: true, upsert: true }
      );
      expect(mockInvalidate).toHaveBeenCalledWith("cache:platform:settings:*");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].result.returnPolicyDays).toBe(10);
      expect(res.json.mock.calls[0][0].result.freeDeliveryThreshold).toBe(499);
    });
  });

  describe("updateSettings (public route for admin)", () => {
    it("validates and accepts returnPolicyDays and freeDeliveryThreshold", async () => {
      mockSettingFindOneAndUpdate.mockResolvedValue({
        toObject: () => ({
          freeDeliveryThreshold: 399,
          returnPolicyDays: 7,
        }),
      });

      const req = {
        body: {
          freeDeliveryThreshold: 399,
          returnPolicyDays: 7,
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await updateSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockInvalidate).toHaveBeenCalledWith("cache:platform:settings:*");
    });
  });
});

