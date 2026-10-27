import { getJSON, setJSON, STORAGE_KEYS } from "@core/utils/storage";
import { isPlaceholderAddressText } from "@shared/utils/orderAddress";

/**
 * Empty placeholder the storefront starts from, before the customer picks or
 * detects a location. It holds no address and no coordinates: anything the
 * catalog needs before then comes from the admin-configured service centre
 * (`settings.defaultBrowseLocation`), never from a value baked into the app.
 */
export const DEFAULT_APP_LOCATION = Object.freeze({
  name: "",
  time: "12-15 mins",
  city: "",
  state: "",
  pincode: "",
  latitude: null,
  longitude: null,
});

export const isDefaultAppLocation = (loc) => {
  if (!loc || typeof loc !== "object") return true;
  if (loc.isDefault) return true;
  const address = loc.address || loc.name || "";
  // Locations stored before the placeholder lost its address text still carry
  // it, so recognise those too.
  if (isPlaceholderAddressText(address)) return true;
  // No address text means nothing the customer gave us, whatever coordinates
  // the catalog is currently centred on.
  return !String(address).trim();
};

/**
 * Converts a stored/current app location into the payload the backend accepts,
 * or undefined when there is nothing real to report. Coordinate-only fallbacks
 * ("Lat …, Lng …") carry a guessed city, so only their coordinates are sent.
 */
export const toReportedLocation = (loc) => {
  if (isDefaultAppLocation(loc)) return undefined;
  // Number(null) / Number("") are 0, so check presence before converting.
  const hasValue = (v) => v !== null && v !== undefined && v !== "";
  const lat = hasValue(loc.latitude) ? Number(loc.latitude) : NaN;
  const lng = hasValue(loc.longitude) ? Number(loc.longitude) : NaN;
  const coords =
    Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null;
  const address = String(loc.address || loc.name || "").slice(0, 300);
  if (address.startsWith("Lat ")) return coords || undefined;
  const location = {
    ...(coords || {}),
    address,
    city: String(loc.city || "").slice(0, 100),
    state: String(loc.state || "").slice(0, 100),
    pincode: String(loc.pincode || "").slice(0, 12),
  };
  return location.city || location.address || coords ? location : undefined;
};

/** The customer's saved app location on this device, ready to report. */
export const getStoredReportedLocation = () =>
  toReportedLocation(getJSON(STORAGE_KEYS.LOCATION, null));

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

const syncFingerprint = (location) =>
  [location.city, location.pincode, location.latitude?.toFixed?.(3), location.longitude?.toFixed?.(3)].join("|");

/**
 * True when this location should be sent to the backend: it differs from the
 * last one sent, or the last send was more than a day ago.
 */
export const shouldSyncLocation = (location) => {
  if (!location) return false;
  const last = getJSON(STORAGE_KEYS.LOCATION_SYNC, null);
  if (!last) return true;
  return last.fingerprint !== syncFingerprint(location) || Date.now() - Number(last.at || 0) > SYNC_INTERVAL_MS;
};

export const markLocationSynced = (location) => {
  setJSON(STORAGE_KEYS.LOCATION_SYNC, { fingerprint: syncFingerprint(location), at: Date.now() });
};
