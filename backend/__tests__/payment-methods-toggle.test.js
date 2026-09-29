import { jest } from "@jest/globals";

let storedSettings = {};

const mockFindOne = jest.fn(() => ({
  ...storedSettings,
  toObject: () => ({ ...storedSettings }),
}));
const mockFindOneAndUpdate = jest.fn((query, update) => {
  storedSettings = { ...storedSettings, ...update.$set };
  return { ...storedSettings, toObject: () => ({ ...storedSettings }) };
});

jest.unstable_mockModule("../app/models/setting.js", () => ({
  default: {
    findOne: mockFindOne,
    findOneAndUpdate: mockFindOneAndUpdate,
    create: jest.fn(async (doc) => ({ ...doc, toObject: () => ({ ...doc }) })),
  },
}));

const { assertPaymentModeEnabled, updateDeliveryFinanceSettings } = await import(
  "../app/services/finance/financeSettingsService.js"
);

beforeEach(() => {
  storedSettings = { codEnabled: true, onlineEnabled: true };
  jest.clearAllMocks();
});

describe("assertPaymentModeEnabled", () => {
  it("allows both methods by default", async () => {
    await expect(assertPaymentModeEnabled("COD")).resolves.toBeUndefined();
    await expect(assertPaymentModeEnabled("ONLINE")).resolves.toBeUndefined();
  });

  it("rejects Cash on Delivery when the admin switched it off", async () => {
    storedSettings.codEnabled = false;
    await expect(assertPaymentModeEnabled("COD")).rejects.toMatchObject({
      statusCode: 400,
      code: "PAYMENT_MODE_DISABLED",
      message: expect.stringMatching(/cash on delivery is currently unavailable/i),
    });
    await expect(assertPaymentModeEnabled("ONLINE")).resolves.toBeUndefined();
  });

  it("rejects online payment when it is switched off", async () => {
    storedSettings.onlineEnabled = false;
    await expect(assertPaymentModeEnabled("ONLINE")).rejects.toMatchObject({ statusCode: 400 });
    await expect(assertPaymentModeEnabled("COD")).resolves.toBeUndefined();
  });
});

describe("updateDeliveryFinanceSettings payment methods", () => {
  it("saves COD off while online stays on", async () => {
    const updated = await updateDeliveryFinanceSettings({ codEnabled: false });
    expect(updated).toMatchObject({ codEnabled: false, onlineEnabled: true });
  });

  it("refuses to switch off the last payment method", async () => {
    storedSettings.onlineEnabled = false;
    await expect(updateDeliveryFinanceSettings({ codEnabled: false })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
  });
});
