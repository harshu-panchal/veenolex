/**
 * Guards for the money-math defects fixed in CALCULATION_FIX_PLAN.md.
 *
 * Each block names the behaviour that used to be wrong, so a regression
 * reads as "we went back to overcharging customers" rather than as an
 * anonymous assertion failure.
 */

import { jest } from "@jest/globals";

const mockProductFind = jest.fn();
const mockCategoryFind = jest.fn();
const mockSellerFindById = jest.fn();
const mockGetOrCreateFinanceSettings = jest.fn();

function createQueryChain(result) {
  return {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
    session: jest.fn().mockReturnThis(),
  };
}

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: { find: mockProductFind },
}));

jest.unstable_mockModule("../app/models/category.js", () => ({
  default: { find: mockCategoryFind },
}));

jest.unstable_mockModule("../app/models/seller.js", () => ({
  default: { findById: mockSellerFindById },
}));

jest.unstable_mockModule("../app/services/finance/financeSettingsService.js", () => ({
  getOrCreateFinanceSettings: mockGetOrCreateFinanceSettings,
}));

// The warehouse lookup hits the database. Stub it, keeping the real constants
// and the routing helpers the pricing service relies on.
const realRouting = await import("../app/services/fulfillmentRoutingService.js");
jest.unstable_mockModule("../app/services/fulfillmentRoutingService.js", () => ({
  ...realRouting,
  getFulfillmentWarehouse: jest.fn().mockResolvedValue({
    hasLocation: true,
    lat: 19.076,
    lng: 72.8777,
    serviceRadiusKm: 10,
  }),
}));

const { buildCheckoutPricingSnapshot } = await import(
  "../app/services/checkoutPricingService.js"
);
const { generateOrderPaymentBreakdown } = await import(
  "../app/services/finance/pricingService.js"
);
const { computeReturnSettlement } = await import(
  "../app/services/order/orderReturnService.js"
);
const { subtractMoney } = await import("../app/utils/money.js");

const SETTINGS = {
  deliveryPricingMode: "distance_based",
  customerBaseDeliveryFee: 30,
  riderBasePayout: 20,
  baseDistanceCapacityKm: 0.5,
  incrementalKmSurcharge: 10,
  deliveryPartnerRatePerKm: 5,
  fixedDeliveryFee: 30,
  warehouseShippingBaseFee: 70,
  handlingFeeStrategy: "highest_category_fee",
  codEnabled: true,
  onlineEnabled: true,
};

const CATEGORY = {
  _id: "h1",
  name: "Header 1",
  adminCommissionType: "percentage",
  adminCommissionValue: 10,
  adminCommissionFixedRule: "per_qty",
  handlingFeeType: "fixed",
  handlingFeeValue: 0,
  handlingFees: 0,
};

const LINE = {
  productId: "p1",
  productName: "Apple",
  quantity: 2,
  price: 100,
  headerCategoryId: "h1",
  sellerId: "seller-a",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetOrCreateFinanceSettings.mockResolvedValue(SETTINGS);
  mockCategoryFind.mockReturnValue(createQueryChain([CATEGORY]));
});

describe("discount can never drive an order negative", () => {
  it("clamps a discount larger than the whole order to zero", async () => {
    const breakdown = await generateOrderPaymentBreakdown({
      preHydratedItems: [LINE],
      distanceKm: 2,
      discountTotal: 9_999_999,
    });

    expect(breakdown.grossTotal).toBe(0);
    expect(breakdown.grandTotal).toBe(0);
    expect(breakdown.payableAmount).toBe(0);
    // The breakdown reports what was applied, not what was asked for, so
    // grossTotal === chargeable - discountTotal always holds.
    expect(breakdown.discountTotal).toBeLessThanOrEqual(
      breakdown.productSubtotal +
        breakdown.deliveryFeeCharged +
        breakdown.handlingFeeCharged,
    );
  });

  it("books the discount against platform earnings", async () => {
    const withoutDiscount = await generateOrderPaymentBreakdown({
      preHydratedItems: [LINE],
      distanceKm: 2,
    });
    const withDiscount = await generateOrderPaymentBreakdown({
      preHydratedItems: [LINE],
      distanceKm: 2,
      discountTotal: 25,
    });

    // The seller is paid the same either way, so the ₹25 has to land on the
    // platform's side of the ledger.
    expect(withDiscount.sellerPayoutTotal).toBe(withoutDiscount.sellerPayoutTotal);
    expect(withDiscount.platformTotalEarning).toBe(
      Number((withoutDiscount.platformTotalEarning - 25).toFixed(2)),
    );
  });
});

describe("wallet redemption reduces what the customer pays", () => {
  it("subtracts the wallet from grandTotal and payableAmount", async () => {
    const breakdown = await generateOrderPaymentBreakdown({
      preHydratedItems: [LINE],
      distanceKm: 2,
      walletAmount: 150,
    });

    expect(breakdown.walletAmount).toBe(150);
    expect(breakdown.grandTotal).toBe(
      Number((breakdown.grossTotal - 150).toFixed(2)),
    );
    expect(breakdown.payableAmount).toBe(breakdown.grandTotal);
  });

  it("clamps a wallet bigger than the order to a zero payable", async () => {
    const breakdown = await generateOrderPaymentBreakdown({
      preHydratedItems: [LINE],
      distanceKm: 2,
      walletAmount: 10_000,
    });

    expect(breakdown.payableAmount).toBe(0);
    expect(breakdown.walletAmount).toBe(breakdown.grossTotal);
  });
});

describe("multi-seller allocation sums back exactly", () => {
  beforeEach(() => {
    mockProductFind.mockReturnValue(
      createQueryChain([
        {
          _id: "p1",
          name: "P1",
          salePrice: 0,
          price: 100,
          headerId: "h1",
          sellerId: "seller-a",
          status: "active",
          variants: [],
        },
        {
          _id: "p2",
          name: "P2",
          salePrice: 0,
          price: 200,
          headerId: "h1",
          sellerId: "seller-b",
          status: "active",
          variants: [],
        },
        {
          _id: "p3",
          name: "P3",
          salePrice: 0,
          price: 50,
          headerId: "h1",
          sellerId: "seller-c",
          status: "active",
          variants: [],
        },
      ]),
    );
  });

  it("splits the wallet across three sellers without losing a paise", async () => {
    const snapshot = await buildCheckoutPricingSnapshot({
      orderItems: [
        { product: "p1", quantity: 1 },
        { product: "p2", quantity: 1 },
        { product: "p3", quantity: 1 },
      ],
      address: {},
      walletAmount: 100,
    });

    const walletParts = snapshot.sellerBreakdownEntries.map(
      (entry) => entry.breakdown.walletAmount,
    );
    expect(Number(walletParts.reduce((a, b) => a + b, 0).toFixed(2))).toBe(100);
    expect(snapshot.aggregateBreakdown.walletAmount).toBe(100);

    // Each seller's payable is their own gross minus their own share.
    for (const entry of snapshot.sellerBreakdownEntries) {
      const { grossTotal, walletAmount, grandTotal, payableAmount } = entry.breakdown;
      expect(grandTotal).toBe(Number((grossTotal - walletAmount).toFixed(2)));
      expect(payableAmount).toBe(grandTotal);
    }
  });

  it("splits a tip across sellers without losing a paise", async () => {
    const snapshot = await buildCheckoutPricingSnapshot({
      orderItems: [
        { product: "p1", quantity: 1 },
        { product: "p2", quantity: 1 },
        { product: "p3", quantity: 1 },
      ],
      address: {},
      tipAmount: 50,
    });

    const tips = snapshot.sellerBreakdownEntries.map(
      (entry) => entry.breakdown.tipTotal,
    );
    expect(Number(tips.reduce((a, b) => a + b, 0).toFixed(2))).toBe(50);
  });
});

describe("courier-shipped (out-of-zone) orders", () => {
  beforeEach(() => {
    mockProductFind.mockReturnValue(
      createQueryChain([
        {
          _id: "p1",
          name: "P1",
          salePrice: 0,
          price: 100,
          headerId: "h1",
          sellerId: "seller-far",
          status: "active",
          variants: [],
          zoneOutDeliveryEnabled: true,
          zoneOutPrice: null,
        },
      ]),
    );
    // A seller ~1100 km from the customer: far outside any service radius.
    mockSellerFindById.mockReturnValue(
      createQueryChain({
        _id: "seller-far",
        shopName: "Far Store",
        serviceRadius: 5,
        location: { coordinates: [72.8777, 19.076] },
      }),
    );
  });

  it("charges the warehouse shipping floor instead of shipping free", async () => {
    const snapshot = await buildCheckoutPricingSnapshot({
      orderItems: [{ product: "p1", quantity: 3 }],
      address: { location: { lat: 28.6139, lng: 77.209 } },
    });

    const entry = snapshot.sellerBreakdownEntries[0];
    expect(entry.isOutOfZone).toBe(true);
    // zoneOutPrice is unset, so the admin-configured floor applies. Before
    // the fix this was ₹0 — free shipping anywhere in India.
    expect(entry.breakdown.deliveryFeeCharged).toBe(70);
  });

  it("pays no rider for an order no rider delivers", async () => {
    const snapshot = await buildCheckoutPricingSnapshot({
      orderItems: [{ product: "p1", quantity: 1 }],
      address: { location: { lat: 28.6139, lng: 77.209 } },
    });

    const { breakdown } = snapshot.sellerBreakdownEntries[0];
    expect(breakdown.riderPayoutBase).toBe(0);
    expect(breakdown.riderPayoutDistance).toBe(0);
    expect(breakdown.riderPayoutTotal).toBe(0);
  });
});

describe("return settlement", () => {
  const order = {
    returnItems: [{ product: "p1", quantity: 1, price: 100 }],
    paymentBreakdown: {
      productSubtotal: 200,
      discountTotal: 50,
      grossTotal: 230,
      grandTotal: 230,
      walletAmount: 0,
      lineItems: [
        {
          productId: "p1",
          quantity: 2,
          unitPrice: 100,
          itemSubtotal: 200,
          sellerPayout: 180,
          adminProductCommission: 20,
        },
      ],
    },
  };

  it("refunds the discounted price, not the list price", () => {
    const settlement = computeReturnSettlement(order);
    // Half the cart came back, so half the ₹50 discount is recovered.
    expect(settlement.customerRefund).toBe(75);
    expect(settlement.discountRecovered).toBe(25);
  });

  it("recovers only what the seller was actually paid", () => {
    const settlement = computeReturnSettlement(order);
    // The seller received ₹90 for this unit (₹100 less ₹10 commission), so
    // that — not the gross ₹100 — is what comes back.
    expect(settlement.sellerRecovery).toBe(90);
    expect(settlement.adminCommissionReversal).toBe(10);
  });

  it("never refunds more than the customer paid", () => {
    const settlement = computeReturnSettlement({
      returnItems: [{ product: "p1", quantity: 10, price: 100 }],
      paymentBreakdown: { ...order.paymentBreakdown, grossTotal: 230 },
    });
    expect(settlement.customerRefund).toBeLessThanOrEqual(230);
  });

  it("falls back to list prices for orders with no frozen line items", () => {
    const settlement = computeReturnSettlement({
      returnItems: [{ product: "p1", quantity: 1, price: 100 }],
      paymentBreakdown: {},
    });
    expect(settlement.customerRefund).toBe(100);
    expect(settlement.sellerRecovery).toBe(100);
  });
});

describe("money helpers", () => {
  it("subtracts instead of adding", () => {
    expect(subtractMoney(100, 30)).toBe(70);
    expect(subtractMoney(100, 30, 20)).toBe(50);
    expect(subtractMoney(0.3, 0.1)).toBe(0.2);
  });
});
