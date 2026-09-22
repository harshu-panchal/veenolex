import { getJSON, setJSON, STORAGE_KEYS } from "@core/utils/storage";

/**
 * Placeholder location the storefront uses until the customer picks or
 * detects a real one. It is persisted to storage, so anything that reports a
 * customer's location must filter it out.
 */
export const DEFAULT_APP_LOCATION = Object.freeze({
  name: "214, Rajshri Palace Colony, Pipliyahana, Indore, Madhya Pradesh 452018, India",
  time: "12-15 mins",
  city: "Indore",
  state: "Madhya Pradesh",
  pincode: "452018",
  latitude: 22.711140989838025,
  longitude: 75.9001552518043,
});

export const isDefaultAppLocation = (loc) => {
  if (!loc || typeof loc !== "object") return true;
  if (loc.isDefault) return true;
  const address = loc.address || loc.name || "";
  return (
    address === DEFAULT_APP_LOCATION.name ||
    (Number(loc.latitude) === DEFAULT_APP_LOCATION.latitude &&
      Number(loc.longitude) === DEFAULT_APP_LOCATION.longitude)
  );
};

/**
 * Converts a stored/current app location into the payload the backend accepts,
 * or undefined when there is nothing real to report. Coordinate-only fallbacks
 * ("Lat …, Lng …") carry a guessed city, so only their coordinates are sent.
 */
export const toReportedLocation = (loc) => {
  if (isDefaultAppLocation(loc)) return undefined;
  const lat = Number(loc.latitude);
  const lng = Number(loc.longitude);
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
