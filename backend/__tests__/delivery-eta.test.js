const { computeDeliveryEta, productDeliveryEstimate, toCustomerEta } = await import(
  "../app/services/deliveryEtaService.js"
);
const { parseShiprocketDate } = await import("../utils/shipRocketService.js");
const { sanitizeOrderForCustomer } = await import("../app/services/orderQueryService.js");

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const NOW = new Date("2026-09-30T04:30:00.000Z");

const warehouse = {
  hasLocation: true,
  lat: 22.72,
  lng: 75.86,
  serviceRadiusKm: 10,
  localDeliveryMaxHours: 24,
  standardDeliveryDaysMin: 1,
  standardDeliveryDaysMax: 3,
};
const shop = { lat: 22.72, lng: 75.86 };
const customerNearby = { lat: 22.75, lng: 75.88 }; // ~4 km
const customerFar = { lat: 23.25, lng: 77.41 }; // Bhopal

function minutesFromNow(date) {
  return Math.round((new Date(date).getTime() - NOW.getTime()) / MINUTE);
}

describe("computeDeliveryEta", () => {
  it("gives a same-day range for a local seller waiting to accept", () => {
    const eta = computeDeliveryEta(
      { workflowStatus: "SELLER_PENDING", fulfilledBy: "SELLER", address: { location: customerNearby } },
      { now: NOW, warehouse, pickupLocation: shop },
    );
    expect(eta.confidence).toBe("estimate");
    expect(minutesFromNow(eta.earliestAt)).toBeGreaterThan(25);
    expect(minutesFromNow(eta.latestAt) - minutesFromNow(eta.earliestAt)).toBe(30);
  });

  it("uses the rider's position once out for delivery", () => {
    const eta = computeDeliveryEta(
      { workflowStatus: "OUT_FOR_DELIVERY", address: { location: customerNearby } },
      { now: NOW, warehouse, pickupLocation: shop, riderLocation: { coordinates: [75.879, 22.748] } },
    );
    expect(eta.confidence).toBe("confirmed");
    expect(minutesFromNow(eta.earliestAt)).toBe(5); // rider is ~200 m away (minimum)
  });

  it("uses Shiprocket's delivery date for courier orders", () => {
    const etd = new Date("2026-10-02T14:30:00.000Z");
    const eta = computeDeliveryEta(
      {
        workflowStatus: "SELLER_ACCEPTED",
        deliveryType: "SHIPROCKET",
        shipRocketDetails: { status: "PICKUP_SCHEDULED", estimatedDelivery: etd },
        address: { location: customerFar },
      },
      { now: NOW, warehouse },
    );
    expect(eta).toMatchObject({ earliestAt: etd, latestAt: etd, confidence: "confirmed" });
  });

  it("falls back to the configured day range until Shiprocket gives a date", () => {
    const eta = computeDeliveryEta(
      { workflowStatus: "SELLER_ACCEPTED", deliveryType: "SHIPROCKET", shipRocketDetails: {}, address: {} },
      { now: NOW, warehouse },
    );
    expect(eta.earliestAt.getTime() - NOW.getTime()).toBe(1 * DAY);
    expect(eta.latestAt.getTime() - NOW.getTime()).toBe(3 * DAY);
  });

  it("warehouse order near the warehouse: estimate up to the local max hours", () => {
    const eta = computeDeliveryEta(
      { workflowStatus: "SELLER_PENDING", fulfilledBy: "ADMIN", address: { location: customerNearby } },
      { now: NOW, warehouse, pickupLocation: { lat: warehouse.lat, lng: warehouse.lng } },
    );
    expect(eta.latestAt.getTime() - NOW.getTime()).toBe(24 * 60 * MINUTE);
  });

  it("warehouse order far away: courier day range before dispatch", () => {
    const eta = computeDeliveryEta(
      { workflowStatus: "SELLER_ACCEPTED", fulfilledBy: "ADMIN", address: { location: customerFar } },
      { now: NOW, warehouse, pickupLocation: { lat: warehouse.lat, lng: warehouse.lng } },
    );
    expect(eta.latestAt.getTime() - NOW.getTime()).toBe(3 * DAY);
  });

  it("has nothing to show for cancelled orders", () => {
    expect(computeDeliveryEta({ workflowStatus: "CANCELLED" }, { now: NOW, warehouse })).toBeNull();
  });
});

describe("customer-facing payloads", () => {
  it("customer ETA drops the internal source", () => {
    const eta = toCustomerEta({ earliestAt: NOW, latestAt: NOW, confidence: "confirmed", source: "courier" });
    expect(eta).not.toHaveProperty("source");
  });

  it("strips every delivery-method detail from customer orders", () => {
    const clean = sanitizeOrderForCustomer({
      orderId: "ORD1",
      deliveryType: "SHIPROCKET",
      shipRocketDetails: { trackingNumber: "AWB1" },
      fulfilledBy: "ADMIN",
      routedReason: "NO_LOCAL_SELLER",
      routingHistory: [{}],
      seller: { shopName: "Veenolex Warehouse", phone: "1", location: { type: "Point", coordinates: [1, 2] } },
      deliveryEta: { earliestAt: NOW, latestAt: NOW, confidence: "estimate", source: "courier_estimate" },
    });
    expect(clean).not.toHaveProperty("deliveryType");
    expect(clean).not.toHaveProperty("shipRocketDetails");
    expect(clean).not.toHaveProperty("fulfilledBy");
    expect(clean).not.toHaveProperty("routingHistory");
    expect(clean.seller).toEqual({ location: { type: "Point", coordinates: [1, 2] } });
    expect(clean.deliveryEta).not.toHaveProperty("source");
  });

  it("product estimates are relative (listings are cached)", () => {
    expect(productDeliveryEstimate({ fromLocalSeller: true, warehouse })).toEqual({ minMinutes: 30, maxMinutes: 120 });
    expect(productDeliveryEstimate({ fromLocalSeller: false, warehouse })).toEqual({ minMinutes: 1440, maxMinutes: 4320 });
  });
});

describe("parseShiprocketDate", () => {
  it("reads both Shiprocket formats and pins date-only values to the evening", () => {
    expect(parseShiprocketDate("2026-10-02 23:59:59").getHours()).toBe(23);
    expect(parseShiprocketDate("Oct 02, 2026").getHours()).toBe(20);
    expect(parseShiprocketDate("not a date")).toBeNull();
    expect(parseShiprocketDate(null)).toBeNull();
  });
});
