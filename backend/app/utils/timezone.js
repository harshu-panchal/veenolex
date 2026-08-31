/**
 * Timezone helpers for reporting windows.
 *
 * Dashboards ("today", "this week") must be bucketed in the *business*
 * timezone, not in whatever timezone the Node process happens to run in.
 * A server running UTC would otherwise roll "today" over at 05:30 IST,
 * so an earning settled at 02:00 IST lands in yesterday's bucket and the
 * rider sees ₹0 today while lifetime totals keep growing.
 *
 * All helpers work off `Intl.DateTimeFormat`, so no extra dependency and
 * DST-correct for zones that observe it.
 */

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";

const partFormatterCache = new Map();

function getFormatter(timeZone) {
  let formatter = partFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** Wall-clock fields of `date` as seen in `timeZone`. */
export function getZonedParts(date, timeZone = APP_TIMEZONE) {
  const parts = {};
  for (const part of getFormatter(timeZone).formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // Intl emits "24" for midnight in some ICU versions.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Offset (ms) to add to a UTC instant to get the zone's wall clock. */
function getZoneOffsetMs(date, timeZone) {
  const { year, month, day, hour, minute, second } = getZonedParts(
    date,
    timeZone,
  );
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  // Drop sub-second noise so repeated calls are stable.
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * The UTC instant at which the given zone's calendar day begins.
 * `dayOffset` shifts by whole days (-1 = yesterday's midnight).
 */
export function startOfZonedDay(
  date = new Date(),
  timeZone = APP_TIMEZONE,
  dayOffset = 0,
) {
  const offset = getZoneOffsetMs(date, timeZone);
  const { year, month, day } = getZonedParts(date, timeZone);
  const wallClockMidnight = Date.UTC(year, month - 1, day + dayOffset);

  let instant = new Date(wallClockMidnight - offset);
  // Re-resolve once: crossing a DST boundary changes the offset that
  // actually applies at midnight (no-op for fixed-offset zones like IST).
  const settledOffset = getZoneOffsetMs(instant, timeZone);
  if (settledOffset !== offset) {
    instant = new Date(wallClockMidnight - settledOffset);
  }
  return instant;
}

/** "YYYY-MM-DD" for `date` as seen in `timeZone`. */
export function zonedDateKey(date, timeZone = APP_TIMEZONE) {
  const { year, month, day } = getZonedParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 0-6 (Sun-Sat) weekday of `date` as seen in `timeZone`. */
export function zonedWeekday(date, timeZone = APP_TIMEZONE) {
  const { year, month, day } = getZonedParts(date, timeZone);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export default {
  APP_TIMEZONE,
  getZonedParts,
  startOfZonedDay,
  zonedDateKey,
  zonedWeekday,
};
