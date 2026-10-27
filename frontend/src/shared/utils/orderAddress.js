/**
 * Helpers for the delivery address stored on an order.
 *
 * An order must carry the address the customer actually ordered to. The
 * storefront used to seed checkout from a placeholder location, so older
 * orders can still hold that placeholder instead of a real address — these
 * helpers detect it so no panel ever presents it as the customer's address.
 */

/**
 * The placeholder the storefront shipped with before checkout required a real
 * location. Nothing writes it any more; this is only here to recognise rows
 * that still hold it. Delete this constant and its two helpers once
 * `backend/migrations/clear-placeholder-addresses.js` has run everywhere.
 */
export const LEGACY_PLACEHOLDER_ADDRESS =
  "214, Rajshri Palace Colony, Pipliyahana, Indore, Madhya Pradesh 452018, India";

/** Coordinates that went with the legacy placeholder address. */
export const LEGACY_PLACEHOLDER_COORDS = Object.freeze({
  lat: 22.711140989838025,
  lng: 75.9001552518043,
});

const norm = (value) => String(value ?? "").trim();

const sameCoords = (lat, lng) =>
  Number(lat) === LEGACY_PLACEHOLDER_COORDS.lat &&
  Number(lng) === LEGACY_PLACEHOLDER_COORDS.lng;

/**
 * True when the text is the legacy placeholder rather than an address the
 * customer entered or detected.
 */
export const isPlaceholderAddressText = (text) =>
  norm(text).toLowerCase() === LEGACY_PLACEHOLDER_ADDRESS.toLowerCase();

/**
 * True when an order address (or any `{ address, location }` shape) is the
 * legacy placeholder and must not be shown as the customer's location.
 */
export const isPlaceholderOrderAddress = (address) => {
  if (!address || typeof address !== "object") return false;
  if (isPlaceholderAddressText(address.address || address.name)) return true;
  const loc = address.location || {};
  return sameCoords(loc.lat ?? address.latitude, loc.lng ?? address.longitude);
};

/**
 * Coordinates to navigate to, or null when the order has none / only the
 * placeholder's.
 */
export const getOrderAddressCoords = (address) => {
  const loc = address?.location;
  if (!loc || !Number.isFinite(Number(loc.lat)) || !Number.isFinite(Number(loc.lng))) {
    return null;
  }
  if (isPlaceholderOrderAddress(address)) return null;
  return { lat: Number(loc.lat), lng: Number(loc.lng) };
};

/**
 * Joins the parts of an order address into one line: blanks are dropped and a
 * part already contained in the street line is not repeated, so an address
 * with no landmark never renders as `"street, , city"`.
 */
export const formatOrderAddress = (address) => {
  if (!address || typeof address !== "object") return "";
  if (isPlaceholderOrderAddress(address)) return "";

  const line = norm(address.address);
  const parts = [line];
  let joined = line.toLowerCase();

  [address.landmark, address.city, address.state, address.pincode].forEach((raw) => {
    const part = norm(raw);
    if (!part || joined.includes(part.toLowerCase())) return;
    parts.push(part);
    joined = `${joined}, ${part.toLowerCase()}`;
  });

  return parts.filter(Boolean).join(", ");
};

/**
 * Everything a panel needs to render an order's delivery address, so no caller
 * has to tell `""`-because-placeholder apart from `""`-because-absent:
 *
 *   text      the address on one line, or "" when there is none to show
 *   coords    where to navigate, or null when the order has no trustworthy
 *             coordinates (navigation must stay hidden rather than send a
 *             rider to the placeholder)
 *   isMissing true when the order carries no address worth showing, so the UI
 *             can say so instead of rendering an empty box
 */
export const getOrderAddressDisplay = (address) => {
  const text = formatOrderAddress(address);
  return {
    text,
    coords: getOrderAddressCoords(address),
    isMissing: !text,
    name: norm(address?.name),
    phone: norm(address?.phone),
  };
};
