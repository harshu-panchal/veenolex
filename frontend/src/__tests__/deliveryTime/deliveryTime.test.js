import { readdirSync, readFileSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  formatDeliveryTime,
  formatArrivalText,
  formatDeliveryText,
  resolveDeliveryWindow,
} from "../../shared/utils/deliveryTime.js";

const MINUTE = 60 * 1000;
// Wed 30 Sep 2026, 10:00 local time
const NOW = new Date(2026, 8, 30, 10, 0, 0).getTime();

describe("formatDeliveryTime", () => {
  it("uses minutes when delivery is within the hour", () => {
    expect(formatDeliveryTime({ earliestAt: NOW + 25 * MINUTE, latestAt: NOW + 25 * MINUTE }, { now: NOW }))
      .toBe("in 25 mins");
  });

  it("shows a minute range when the window is wide", () => {
    expect(formatDeliveryTime({ earliestAt: NOW + 20 * MINUTE, latestAt: NOW + 40 * MINUTE }, { now: NOW }))
      .toBe("in 20-40 mins");
  });

  it("uses a clock time later the same day", () => {
    const text = formatDeliveryTime({ earliestAt: NOW + 2 * 60 * MINUTE, latestAt: NOW + 3 * 60 * MINUTE }, { now: NOW });
    expect(text).toMatch(/^by 1:00\s?pm$/i);
  });

  it("says tomorrow for next-day delivery", () => {
    const tomorrow8pm = new Date(2026, 9, 1, 20, 0, 0).getTime();
    expect(formatDeliveryTime({ earliestAt: tomorrow8pm, latestAt: tomorrow8pm }, { now: NOW }))
      .toMatch(/^by tomorrow, 8:00\s?pm$/i);
  });

  it("uses the latest date for multi-day windows", () => {
    const sat = new Date(2026, 9, 3, 20, 0, 0).getTime();
    expect(formatDeliveryTime({ earliestAt: NOW + 24 * 60 * MINUTE, latestAt: sat }, { now: NOW }))
      .toMatch(/^by Sat,? 3 Oct$/);
  });

  it("accepts relative product estimates", () => {
    expect(resolveDeliveryWindow({ minMinutes: 30, maxMinutes: 120 }, NOW)).toEqual({
      earliest: NOW + 30 * MINUTE,
      latest: NOW + 120 * MINUTE,
    });
    expect(formatDeliveryText({ minMinutes: 30, maxMinutes: 45 }, { now: NOW })).toBe("Delivery in 30-45 mins");
  });

  it("never shows a time in the past", () => {
    expect(formatArrivalText({ earliestAt: NOW - 60 * MINUTE, latestAt: NOW - 30 * MINUTE }, { now: NOW }))
      .toBe("Arriving in 5 mins");
  });

  it("returns null without an estimate", () => {
    expect(formatArrivalText(null)).toBeNull();
    expect(formatDeliveryText({})).toBeNull();
  });
});

describe("customer screens only show delivery time", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const customerDir = join(here, "../../modules/customer");
  const FORBIDDEN = /shiprocket|fast local delivery|standard delivery|standard shipping|delivered by veenolex|local partner store|deliveryBadge|deliveryMethod/i;

  function sourceFiles(dir) {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return sourceFiles(full);
      return /\.(jsx?|tsx?)$/.test(name) ? [full] : [];
    });
  }

  it("has no delivery-method wording in the customer module", () => {
    const offenders = sourceFiles(customerDir).filter((file) => FORBIDDEN.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
