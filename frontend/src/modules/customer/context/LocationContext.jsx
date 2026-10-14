import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { customerApi } from "../services/customerApi";
import { hasValidStoredAuthToken } from "@core/utils/authStorage";
import { getJSON, setJSON, STORAGE_KEYS } from "@core/utils/storage";
import {
  DEFAULT_APP_LOCATION,
  isDefaultAppLocation,
  markLocationSynced,
  shouldSyncLocation,
  toReportedLocation,
} from "../utils/appLocation";

const LocationContext = createContext(undefined);
const STORAGE_KEY = STORAGE_KEYS.LOCATION;
// 30 days — refresh the cached coordinates if a user comes back to a stale tab
// after roughly a month so we don't keep serving locations from a previous
// address indefinitely.
const LOCATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const LocationProvider = ({ children }) => {
  // Default location (used until we can resolve a better one)
  const [currentLocation, setCurrentLocation] = useState({
    ...DEFAULT_APP_LOCATION,
    isDefault: true,
  });

  // Address list for drawer UI – will be hydrated from profile API.
  const [savedAddresses, setSavedAddresses] = useState([]);

  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);

  // Update the current location.
  // By default this does NOT change saved addresses; only explicit
  // address actions should touch the saved list.
  const updateLocation = (
    newLoc,
    { persist = true, updateSavedHome = false } = {},
  ) => {
    setCurrentLocation(newLoc);

    if (updateSavedHome) {
      setSavedAddresses((prev) =>
        prev.map((addr) =>
          addr.label === "Home" ? { ...addr, address: newLoc.name } : addr,
        ),
      );
    }

    if (persist) {
      const payload = {
        address: newLoc.name,
        city: newLoc.city,
        state: newLoc.state,
        pincode: newLoc.pincode,
        latitude: newLoc.latitude,
        longitude: newLoc.longitude,
        // Internal app properties
        time: newLoc.time,
        ...(newLoc.updatedAt ? { updatedAt: newLoc.updatedAt } : {}),
        // Marks the placeholder location so it is never reported as the customer's.
        ...(newLoc.isDefault ? { isDefault: true } : {}),
      };
      setJSON(STORAGE_KEY, payload, { ttlMs: LOCATION_TTL_MS });
    }
  };

  const addAddress = (newAddress) => {
    setSavedAddresses((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        label: newAddress.label || "Other",
        address: newAddress.address,
        phone: newAddress.phone || "N/A",
        isCurrent: false,
      },
    ]);
  };

  // Resolve location once using browser geolocation + Google Maps Geocoding.
  // Must be called directly from a user gesture (click/tap) for the browser to show the permission prompt.
  const fetchAndCacheLocation = () =>
    new Promise((resolve) => {
      if (
        typeof window === "undefined" ||
        !("navigator" in window) ||
        !navigator.geolocation
      ) {
        resolve({
          ok: false,
          error: "Geolocation is not supported on this device",
        });
        return;
      }

      setIsFetchingLocation(true);
      setLocationError(null);

      const fallbackFromCoords = (latitude, longitude) => ({
        name: `Lat ${Number(latitude).toFixed(5)}, Lng ${Number(longitude).toFixed(5)}`,
        time: "12-15 mins",
        // Never borrow the placeholder's city/state/pincode for a real position.
        city: (!currentLocation?.isDefault && currentLocation?.city) || "",
        state: (!currentLocation?.isDefault && currentLocation?.state) || "",
        pincode: (!currentLocation?.isDefault && currentLocation?.pincode) || "",
        latitude,
        longitude,
        updatedAt: new Date().toISOString(),
      });

      const handleLocationSuccess = async (latitude, longitude) => {
        try {
          // Always succeed with coordinates (needed for delivery fee calculation),
          // even if reverse geocoding fails (key missing / quota / restrictions).
          let liveLocation = fallbackFromCoords(latitude, longitude);

          const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

          if (apiKey) {
            const params = new URLSearchParams({
              latlng: `${latitude},${longitude}`,
              key: apiKey,
            });

            const response = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
            );

            if (!response.ok) {
              throw new Error("Failed to fetch address from Google Maps");
            }

            const data = await response.json();

            // Handle Google Geocoding API error responses
            if (data.status === "REQUEST_DENIED") {
              const msg =
                data.error_message ||
                "Geocoding API rejected (check API key restrictions)";
              throw new Error(msg);
            }
            if (data.status === "OVER_QUERY_LIMIT") {
              throw new Error("Geocoding API quota exceeded");
            }
            if (!data.results || data.results.length === 0) {
              throw new Error(
                data.error_message || "No address found for current location",
              );
            }

            const components = data.results[0].address_components || [];

            const getComponent = (types) =>
              components.find((c) => types.every((t) => c.types.includes(t)))
                ?.long_name;

            // Build address from components to match: "214, Rajshri Palace Colony, Pipliyahana, Indore, Madhya Pradesh 452018, India"
            const premise = getComponent(["premise"]);
            const neighborhood = getComponent(["neighborhood"]);
            const sublocality = getComponent([
              "sublocality_level_1",
              "sublocality",
            ]);
            const locality = getComponent(["locality"]);
            const state = getComponent(["administrative_area_level_1"]);
            const pincode = getComponent(["postal_code"]);
            const country = getComponent(["country"]);

            const displayParts = [];
            if (premise) displayParts.push(premise);
            if (neighborhood) displayParts.push(neighborhood);
            if (sublocality && sublocality !== neighborhood)
              displayParts.push(sublocality);
            if (locality) displayParts.push(locality);

            let statePincode = "";
            if (state) statePincode += state;
            if (pincode) statePincode += (statePincode ? " " : "") + pincode;
            if (statePincode) displayParts.push(statePincode);

            if (country) displayParts.push(country);

            const friendlyName =
              displayParts.join(", ") || data.results[0].formatted_address;

            liveLocation = {
              name: friendlyName,
              time: "12-15 mins",
              city: locality || liveLocation.city,
              state: state || liveLocation.state,
              pincode: pincode || liveLocation.pincode,
              latitude: latitude,
              longitude: longitude,
              updatedAt: liveLocation.updatedAt,
            };
          }

          updateLocation(liveLocation, {
            persist: true,
            updateSavedHome: false,
          });
          resolve({ ok: true, location: liveLocation });
        } catch (err) {
          const loc = fallbackFromCoords(latitude, longitude);
          updateLocation(loc, { persist: true, updateSavedHome: false });
          resolve({
            ok: true,
            location: loc,
            warning: err?.message || "Unable to fetch address",
          });
        } finally {
          setIsFetchingLocation(false);
        }
      };

      const handleLocationError = (error) => {
        const message = typeof error === 'string' ? error : (error.message || "Location permission denied");
        setLocationError(message);
        setIsFetchingLocation(false);
        resolve({ ok: false, error: message });
      };

      // Native Flutter Bridge
      if (window.Flutter) {
        import("../../../lib/appZetoBridge").then(async (m) => {
          const AppZetoBridge = m.default;
          const coords = await AppZetoBridge.getLocation();
          if (coords && coords.lat && coords.lng) {
            handleLocationSuccess(coords.lat, coords.lng);
          } else {
            handleLocationError("Native location failed");
          }
        }).catch(() => handleLocationError("Bridge not found"));
        return;
      }

      // Standard Browser Geolocation
      navigator.geolocation.getCurrentPosition(
        (position) => handleLocationSuccess(position.coords.latitude, position.coords.longitude),
        handleLocationError,
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        },
      );
    });

  const refreshAddresses = useCallback(async () => {
    // Skip if user is not logged in – getProfile would 401 and trigger axios reload loop
    if (!hasValidStoredAuthToken("auth_customer")) return;
    try {
      const { data } = await customerApi.getProfile();
      const profile = data?.result ?? data?.data ?? data;
      // A returning user on a fresh device: use the location saved on their
      // account instead of the placeholder.
      const saved = profile?.location;
      if (
        saved &&
        Number.isFinite(Number(saved.latitude)) &&
        Number.isFinite(Number(saved.longitude)) &&
        saved.latitude !== null &&
        saved.longitude !== null &&
        isDefaultAppLocation(getJSON(STORAGE_KEY, null))
      ) {
        updateLocation(
          {
            name: saved.address || `Lat ${Number(saved.latitude).toFixed(5)}, Lng ${Number(saved.longitude).toFixed(5)}`,
            time: "12-15 mins",
            city: saved.city || "",
            state: saved.state || "",
            pincode: saved.pincode || "",
            latitude: Number(saved.latitude),
            longitude: Number(saved.longitude),
            updatedAt: saved.updatedAt || undefined,
          },
          { persist: true, updateSavedHome: false },
        );
      }
      const raw = Array.isArray(profile?.addresses) ? profile.addresses : [];
      setSavedAddresses(
        raw.map((addr, idx) => ({
          id: addr._id ?? String(idx),
          label:
            (addr.label || "Home").charAt(0).toUpperCase() +
            (addr.label || "home").slice(1),
          address:
            addr.fullAddress ||
            [addr.landmark, addr.city, addr.state, addr.pincode]
              .filter(Boolean)
              .join(", ") ||
            "",
          location:
            addr?.location &&
            typeof addr.location.lat === "number" &&
            typeof addr.location.lng === "number" &&
            Number.isFinite(addr.location.lat) &&
            Number.isFinite(addr.location.lng)
              ? { lat: addr.location.lat, lng: addr.location.lng }
              : null,
          placeId: typeof addr?.placeId === "string" ? addr.placeId : null,
          phone: profile?.phone ?? "",
          isCurrent: idx === 0,
        })),
      );
    } catch {
      // If API fails, keep existing in-memory addresses.
    }
  }, []);

  // On mount: hydrate saved addresses from profile (only when customer is logged in)
  useEffect(() => {
    refreshAddresses();
  }, [refreshAddresses]);

  // On mount: only restore from cache. Do NOT auto-fetch – browsers block the
  // location prompt unless it's triggered by a user gesture (e.g. tap).
  useEffect(() => {
    const parsed = getJSON(STORAGE_KEY, null);
    const addressName = parsed?.address || parsed?.name;
    if (parsed && addressName) {
      updateLocation(
        {
          name: addressName,
          time: parsed.time || "12-15 mins",
          city: parsed.city,
          state: parsed.state,
          pincode: parsed.pincode,
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          updatedAt: parsed.updatedAt,
          // Keep the placeholder flagged so it is never shown as the customer's.
          ...(isDefaultAppLocation(parsed) ? { isDefault: true } : {}),
        },
        { persist: false, updateSavedHome: false },
      );
    }
    // Otherwise keep the in-memory placeholder; it is deliberately not persisted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Browsers only show the permission prompt on a user gesture, but when the
  // user has already granted access we can detect silently, and again the
  // moment they enable it in browser settings.
  useEffect(() => {
    if (typeof navigator === "undefined") return undefined;
    let status;
    let cancelled = false;
    const detectIfGranted = () => {
      if (status?.state === "granted") fetchAndCacheLocation();
    };
    if (window.Flutter) {
      // Native bridge manages its own permission; fetch once.
      fetchAndCacheLocation();
      return undefined;
    }
    if (!navigator.permissions?.query) return undefined;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        if (cancelled) return;
        status = result;
        detectIfGranted();
        status.onchange = detectIfGranted;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the customer's last known app location up to date on their account
  // (shown to admins). Sent at most once a day unless the location changes;
  // failures are ignored so this can never affect the storefront.
  useEffect(() => {
    if (!hasValidStoredAuthToken("auth_customer")) return;
    const reported = toReportedLocation(currentLocation);
    if (!shouldSyncLocation(reported)) return;
    customerApi
      .updateLastLocation(reported)
      .then(() => markLocationSynced(reported))
      .catch(() => {});
  }, [currentLocation]);

  const locationValue = useMemo(() => ({
    currentLocation,
    hasRealLocation: !isDefaultAppLocation(currentLocation),
    savedAddresses,
    updateLocation,
    addAddress,
    refreshAddresses,
    isFetchingLocation,
    locationError,
    refreshLocation: fetchAndCacheLocation,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [currentLocation, savedAddresses, isFetchingLocation, locationError, refreshAddresses]);

  return (
    <LocationContext.Provider value={locationValue}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
};
