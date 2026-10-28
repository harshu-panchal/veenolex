import { jest } from "@jest/globals";

/**
 * A customer anywhere in India must be able to order.
 *
 * Previously `computeDistanceKmForSeller` threw a 400 ("<Store> does not
 * deliver to your current location") whenever a seller was outside its
 * radius and not every line carried `zoneOutDeliveryEnabled`. The common
 * trigger was adding items while near a seller and then switching to a
 * distant address — the cart simply refused to proceed.
 *
 * The rule now: if a local seller can reach the address, it fulfils the
 * order; if none can, those lines move to the admin warehouse and the order
 * is accepted, landing in the admin queue where admin picks the dispatch
 * method. Nothing is refused for being far away.
 */

const mockSellerFindById = jest.fn();

jest.unstable_mockModule("../app/models/seller.js", () => ({
  default: { findById: mockSellerFindById },
}));

const { reassignUnreachableSellerItemsToAdmin } = await import(
  "../app/services/checkoutPricingService.js"
);
const { ADMIN_FULFILLER, ROUTED_REASON } = await import(
  "../app/services/fulfillmentRoutingService.js"
);

// Indore, where the seller sits.
const SELLER_LAT = 22.7174071;
const SELLER_LNG = 75.8722698;

function mockSeller({ serviceRadius = 10 } = {}) {
  mockSellerFindById.mockReturnValue({
    select: () => ({
      lean: async () => ({
        _id: "seller-1",
        serviceRadius,
        location: { type: "Point", coordinates: [SELLER_LNG, SELLER_LAT] },
      }),
    }),
  });
}

const lines = () => [
  { name: "Seller item", sellerId: "seller-1", quantity: 1 },
  { name: "Admin item", sellerId: ADMIN_FULFILLER, quantity: 1 },
];

describe("checkout routing for addresses with no local seller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("moves far-away seller lines to the admin warehouse", async () => {
    mockSeller();
    // Delhi — well outside any plausible seller radius.
    const routed = await reassignUnreachableSellerItemsToAdmin(lines(), {
      lat: 28.6139,
      lng: 77.209,
    });

    expect(routed[0].sellerId).toBe(ADMIN_FULFILLER);
    expect(routed[0].fulfilledBy).toBe(ADMIN_FULFILLER);
    expect(routed[0].routedReason).toBe(ROUTED_REASON.NO_LOCAL_SELLER);
    // The seller it would normally have come from is kept for admin.
    expect(routed[0].originalSellerId).toBe("seller-1");
    // Admin lines are untouched.
    expect(routed[1].sellerId).toBe(ADMIN_FULFILLER);
  });

  test("leaves lines with the seller when it can reach the address", async () => {
    mockSeller();
    const routed = await reassignUnreachableSellerItemsToAdmin(lines(), {
      lat: SELLER_LAT,
      lng: SELLER_LNG,
    });

    expect(routed[0].sellerId).toBe("seller-1");
    expect(routed[0].routedReason).toBeUndefined();
  });

  test("never throws for a distant address, whatever the zone-out flags", async () => {
    mockSeller({ serviceRadius: 1 });
    // No line carries zoneOutDeliveryEnabled — the exact shape that used to
    // produce a 400 and strand the cart.
    await expect(
      reassignUnreachableSellerItemsToAdmin(lines(), { lat: 28.6139, lng: 77.209 }),
    ).resolves.toBeDefined();
  });

  test("returns items untouched when the address has no coordinates", async () => {
    const original = lines();
    const routed = await reassignUnreachableSellerItemsToAdmin(original, null);
    expect(routed).toBe(original);
    expect(mockSellerFindById).not.toHaveBeenCalled();
  });
});
