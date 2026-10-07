import { describe, expect, it } from "@jest/globals";

const { computeCodAdvanceAllocation } = await import("../app/services/checkoutPricingService.js");
const { getCodCashDue } = await import("../app/services/finance/orderFinanceService.js");

const settings = (overrides = {}) => ({
  codAdvanceEnabled: true,
  codAdvanceAmount: 50,
  codAdvanceScope: "PER_CHECKOUT",
  ...overrides,
});

describe("computeCodAdvanceAllocation", () => {
  it("charges the full advance on a single order", () => {
    expect(computeCodAdvanceAllocation([480], settings())).toEqual([50]);
  });

  it("splits a per-checkout advance across orders and sums to exactly the amount", () => {
    const split = computeCodAdvanceAllocation([100, 200, 33.33], settings());
    expect(split.reduce((sum, value) => sum + value, 0)).toBeCloseTo(50, 2);
    expect(split[1]).toBeGreaterThan(split[0]);
  });

  it("charges the advance on every order in per-order mode", () => {
    expect(computeCodAdvanceAllocation([100, 200, 300], settings({ codAdvanceScope: "PER_ORDER" })))
      .toEqual([50, 50, 50]);
  });

  it("never charges more than an order's total", () => {
    expect(computeCodAdvanceAllocation([30], settings())).toEqual([30]);
    expect(computeCodAdvanceAllocation([30, 500], settings({ codAdvanceScope: "PER_ORDER" })))
      .toEqual([30, 50]);
  });

  it("charges nothing when disabled or set to 0", () => {
    expect(computeCodAdvanceAllocation([480], settings({ codAdvanceEnabled: false }))).toEqual([0]);
    expect(computeCodAdvanceAllocation([480], settings({ codAdvanceAmount: 0 }))).toEqual([0]);
  });
});

describe("getCodCashDue", () => {
  it("collects the balance once the advance is captured", () => {
    expect(getCodCashDue({
      paymentBreakdown: { grandTotal: 480 },
      codAdvance: { amount: 50 },
      financeFlags: { codAdvanceCaptured: true },
    })).toBe(430);
  });

  it("collects the full total when no advance was captured", () => {
    expect(getCodCashDue({
      paymentBreakdown: { grandTotal: 480 },
      codAdvance: { amount: 50 },
      financeFlags: { codAdvanceCaptured: false },
    })).toBe(480);
    expect(getCodCashDue({ pricing: { total: 200 } })).toBe(200);
  });
});
