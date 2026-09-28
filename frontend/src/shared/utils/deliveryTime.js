/**
 * Customer-facing delivery time formatting.
 *
 * Customers only ever see *when* something arrives — never how it is
 * delivered. Every customer screen formats times through here so the
 * wording stays consistent:
 *   - within the hour:        "in 25 mins" / "in 20-30 mins"
 *   - later today:            "by 6:30 PM"
 *   - tomorrow:               "by tomorrow, 8:00 PM"
 *   - later:                  "by Thu, 2 Oct"
 */

const MINUTE = 60 * 1000;

/**
 * Normalise an estimate into absolute times. Accepts either
 * `{ earliestAt, latestAt }` (orders, checkout) or
 * `{ minMinutes, maxMinutes }` (product listings, relative to now).
 */
export function resolveDeliveryWindow(estimate, now = Date.now()) {
  if (!estimate) return null;
  if (estimate.minMinutes != null || estimate.maxMinutes != null) {
    const min = Number(estimate.minMinutes ?? estimate.maxMinutes);
    const max = Number(estimate.maxMinutes ?? estimate.minMinutes);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    return { earliest: now + min * MINUTE, latest: now + max * MINUTE };
  }
  const earliest = new Date(estimate.earliestAt || estimate.latestAt).getTime();
  const latest = new Date(estimate.latestAt || estimate.earliestAt).getTime();
  if (!Number.isFinite(earliest) || !Number.isFinite(latest)) return null;
  return { earliest, latest };
}

function isSameDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function clockTime(ms) {
  return new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function dayLabel(ms) {
  return new Date(ms).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * The time phrase on its own ("in 25 mins", "by Thu, 2 Oct"), or null.
 */
export function formatDeliveryTime(estimate, { now = Date.now() } = {}) {
  const window = resolveDeliveryWindow(estimate, now);
  if (!window) return null;

  // Never promise a time that has already passed.
  const latest = Math.max(window.latest, now + 5 * MINUTE);
  const earliest = Math.min(Math.max(window.earliest, now), latest);

  const latestMinutes = Math.round((latest - now) / MINUTE);
  if (latestMinutes <= 60) {
    const earliestMinutes = Math.round((earliest - now) / MINUTE);
    return latestMinutes - earliestMinutes >= 10
      ? `in ${Math.max(1, earliestMinutes)}-${latestMinutes} mins`
      : `in ${latestMinutes} mins`;
  }
  if (isSameDay(latest, now)) {
    return `by ${clockTime(latest)}`;
  }
  const tomorrow = now + 24 * 60 * MINUTE;
  if (isSameDay(latest, tomorrow)) {
    return `by tomorrow, ${clockTime(latest)}`;
  }
  return `by ${dayLabel(latest)}`;
}

/** "Arriving by 6:30 PM" — for placed orders. */
export function formatArrivalText(estimate, options) {
  const phrase = formatDeliveryTime(estimate, options);
  return phrase ? `Arriving ${phrase}` : null;
}

/** "Delivery by Thu, 2 Oct" — for products and checkout. */
export function formatDeliveryText(estimate, options) {
  const phrase = formatDeliveryTime(estimate, options);
  return phrase ? `Delivery ${phrase}` : null;
}

/** "Delivered on Thu, 2 Oct, 6:30 PM" */
export function formatDeliveredText(deliveredAt) {
  if (!deliveredAt) return 'Delivered';
  const ms = new Date(deliveredAt).getTime();
  if (!Number.isFinite(ms)) return 'Delivered';
  return `Delivered on ${dayLabel(ms)}, ${clockTime(ms)}`;
}
