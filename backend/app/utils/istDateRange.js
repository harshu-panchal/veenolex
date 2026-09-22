/**
 * Helpers for dashboard date filters. Filter dates arrive as YYYY-MM-DD and are
 * interpreted as IST calendar days, independent of the server's own timezone.
 */

export const IST_OFFSET = "+05:30";
const IST_OFFSET_MS = 330 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const MAX_RANGE_DAYS = 366;

/** Start of an IST calendar day given as YYYY-MM-DD, or null if invalid. */
export function parseIstDay(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const start = new Date(`${value}T00:00:00${IST_OFFSET}`);
  return Number.isNaN(start.getTime()) ? null : start;
}

/**
 * Resolves an inclusive IST day range from `from`/`to` (YYYY-MM-DD).
 * Either bound alone means that single day. Returns null when no valid bound is given.
 */
export function getIstDateRange(from, to, { maxDays = MAX_RANGE_DAYS } = {}) {
  let start = parseIstDay(from) || parseIstDay(to);
  let last = parseIstDay(to) || parseIstDay(from);
  if (!start) return null;
  if (last < start) [start, last] = [last, start];
  const days = Math.min(Math.round((last - start) / DAY_MS) + 1, maxDays);
  return {
    start,
    end: new Date(start.getTime() + days * DAY_MS),
    from: toIstDateString(start),
    to: toIstDateString(new Date(start.getTime() + (days - 1) * DAY_MS)),
    days,
  };
}

/** YYYY-MM-DD of the given instant in IST. */
export function toIstDateString(d) {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function formatIstTime(d, withDate = false) {
  return new Date(d).toLocaleString("en-IN", {
    ...(withDate ? { day: "numeric", month: "short" } : {}),
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}
