/**
 * Persist last known rider coordinates (localStorage) and use as fallback when
 * getCurrentPosition fails (permission denied, timeout, GPS off).
 */

import { getJSON, setJSON, STORAGE_KEYS } from "@core/utils/storage";

const STORAGE_KEY = STORAGE_KEYS.DELIVERY_LAST_LOCATION;

/** Default: accept cached coords up to this age for API calls (geofencing may reject very stale). */
const DEFAULT_MAX_CACHE_AGE_MS = 20 * 60 * 1000; // 20 minutes

export function saveDeliveryPartnerLocation(lat, lng) {
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return;
  }
  setJSON(STORAGE_KEY, { lat, lng, savedAt: Date.now() });
}

/**
 * @param {number} [maxAgeMs] - ignore cache older than this
 * @returns {{ lat: number, lng: number, savedAt: number } | null}
 */
export function getCachedDeliveryPartnerLocation(
  maxAgeMs = DEFAULT_MAX_CACHE_AGE_MS,
) {
  const o = getJSON(STORAGE_KEY, null);
  if (
    !o ||
    typeof o.lat !== "number" ||
    typeof o.lng !== "number" ||
    !Number.isFinite(o.lat) ||
    !Number.isFinite(o.lng)
  ) {
    return null;
  }
  const savedAt = typeof o.savedAt === "number" ? o.savedAt : 0;
  if (maxAgeMs > 0 && Date.now() - savedAt > maxAgeMs) return null;
  return { lat: o.lat, lng: o.lng, savedAt };
}

/**
 * Try live GPS (strict), then browser cached position (looser), then localStorage.
 * @param {(result: { lat: number, lng: number, fromCache: boolean }) => void} onSuccess
 * @param {() => void} [onHardFail] - no live fix and no valid localStorage
 * @param {{ maxCacheAgeMs?: number, geoOptions?: PositionOptions }} [options]
 */
export function getCurrentPositionWithCache(onSuccess, onHardFail, options = {}) {
  const maxCacheAgeMs =
    options.maxCacheAgeMs ?? DEFAULT_MAX_CACHE_AGE_MS;
  const strictOpts = options.geoOptions ?? {
    enableHighAccuracy: true,
    maximumAge: 10000,
    timeout: 20000,
  };
  const looseOpts = {
    enableHighAccuracy: false,
    maximumAge: 120000,
    timeout: 15000,
  };

  const finishLive = (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    saveDeliveryPartnerLocation(lat, lng);
    onSuccess({ lat, lng, fromCache: false });
  };

  const tryLocalStorage = () => {
    const c = getCachedDeliveryPartnerLocation(maxCacheAgeMs);
    if (c) {
      onSuccess({ lat: c.lat, lng: c.lng, fromCache: true });
      return;
    }
    onHardFail?.(new Error("Unable to determine location. Please enable GPS and allow location access."));
  };

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    tryLocalStorage();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    finishLive,
    () => {
      navigator.geolocation.getCurrentPosition(
        finishLive,
        tryLocalStorage,
        looseOpts,
      );
    },
    strictOpts,
  );
}

/**
 * Fast resolution for interactive UI actions (e.g., slider swipe).
 * Checks cached location first; if valid, immediately returns it while triggering
 * a background live GPS refresh. If no cache, waits up to timeoutMs (default 1500ms).
 */
export async function getQuickDeliveryPosition(options = {}) {
  const maxCacheAgeMs = options.maxCacheAgeMs ?? DEFAULT_MAX_CACHE_AGE_MS;
  const timeoutMs = options.timeoutMs ?? 1500;

  // 1. Instant check from localStorage
  const cached = getCachedDeliveryPartnerLocation(maxCacheAgeMs);
  if (cached) {
    // Trigger background GPS update to keep cache fresh without blocking the UI
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => saveDeliveryPartnerLocation(pos.coords.latitude, pos.coords.longitude),
        () => {},
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 5000 }
      );
    }
    return { lat: cached.lat, lng: cached.lng, fromCache: true };
  }

  // 2. If no cache, race fast GPS with timeout
  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        const fallback = getCachedDeliveryPartnerLocation(24 * 60 * 60 * 1000); // 24h fallback
        if (fallback) {
          resolve({ lat: fallback.lat, lng: fallback.lng, fromCache: true });
        } else {
          resolve({ lat: 0, lng: 0, fromCache: false });
        }
      }
    }, timeoutMs);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      clearTimeout(timer);
      const fallback = getCachedDeliveryPartnerLocation(24 * 60 * 60 * 1000);
      return resolve(fallback ? { ...fallback, fromCache: true } : { lat: 0, lng: 0, fromCache: false });
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          saveDeliveryPartnerLocation(pos.coords.latitude, pos.coords.longitude);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, fromCache: false });
        }
      },
      () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          const fallback = getCachedDeliveryPartnerLocation(24 * 60 * 60 * 1000);
          resolve(fallback ? { ...fallback, fromCache: true } : { lat: 0, lng: 0, fromCache: false });
        }
      },
      { enableHighAccuracy: false, maximumAge: 30000, timeout: timeoutMs }
    );
  });
}

