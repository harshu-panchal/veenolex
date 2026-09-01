import { useState, useEffect, useRef, useCallback } from "react";
import { loadGoogleMaps } from "@/core/services/googleMapsLoader";
import { customerApi } from "@/modules/customer/services/customerApi";

const CACHE_TTL_MS = 3 * 60 * 1000;
const placesCache = new Map();

/**
 * Helper to extract components from Google Maps address_components
 */
export const parseGoogleAddressComponents = (components = [], formattedAddress = "") => {
  const getComp = (types, useShort = false) => {
    const comp = components.find((c) => types.some((t) => c.types.includes(t)));
    if (!comp) return "";
    return useShort ? comp.short_name : comp.long_name;
  };

  // Locality / City extraction
  const city =
    getComp(["locality"]) ||
    getComp(["sublocality_level_1"]) ||
    getComp(["postal_town"]) ||
    getComp(["administrative_area_level_2"]) ||
    "";

  // State extraction
  const state = getComp(["administrative_area_level_1"]) || "";

  // Postal code extraction
  const pincode = getComp(["postal_code"]) || "";

  // Landmark / Neighborhood
  const landmark =
    getComp(["neighborhood"]) ||
    getComp(["sublocality_level_2"]) ||
    getComp(["sublocality"]) ||
    "";

  // Street / Premise / Area
  const premise = getComp(["premise"]) || getComp(["subpremise"]);
  const streetNumber = getComp(["street_number"]);
  const route = getComp(["route"]);
  const sublocality = getComp(["sublocality_level_1"]) || getComp(["sublocality"]);

  const streetParts = [premise, streetNumber, route, sublocality].filter(Boolean);
  const streetAddress = streetParts.length > 0 ? streetParts.join(", ") : formattedAddress;

  return {
    city,
    state,
    pincode,
    landmark,
    streetAddress,
    formattedAddress,
  };
};

export const useGooglePlacesAutocomplete = ({ mode = "address", minLength = 3, debounceMs = 350 } = {}) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isServiceReady, setIsServiceReady] = useState(false);

  const autocompleteServiceRef = useRef(null);
  const geocoderRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const latestRequestRef = useRef(0);

  // Initialize Google Maps client
  useEffect(() => {
    let isMounted = true;
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      setIsServiceReady(false);
      return;
    }

    loadGoogleMaps(apiKey)
      .then(() => {
        if (!isMounted) return;
        if (window.google?.maps?.places) {
          autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
          geocoderRef.current = new window.google.maps.Geocoder();
          setIsServiceReady(true);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn("Google Maps places load failed, will use backend fallback:", err?.message);
          setIsServiceReady(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const getSessionToken = useCallback(() => {
    if (!sessionTokenRef.current && window.google?.maps?.places?.AutocompleteSessionToken) {
      sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
    }
    return sessionTokenRef.current;
  }, []);

  const resetSessionToken = useCallback(() => {
    sessionTokenRef.current = null;
  }, []);

  // Fetch suggestions when query changes
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < minLength) {
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const cacheKey = `${mode}:${trimmed.toLowerCase()}`;
    const cached = placesCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setSuggestions(cached.suggestions);
      setIsLoading(false);
      return;
    }

    const requestId = ++latestRequestRef.current;
    setIsLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        // Try Google Maps client-side service first
        if (autocompleteServiceRef.current && window.google?.maps) {
          const request = {
            input: trimmed,
            componentRestrictions: { country: "in" },
            sessionToken: getSessionToken(),
          };

          if (mode === "city") {
            request.types = ["(cities)"];
          } else {
            // General address / place search
            request.types = ["geocode", "establishment"];
          }

          autocompleteServiceRef.current.getPlacePredictions(
            request,
            (predictions, status) => {
              if (requestId !== latestRequestRef.current) return;
              setIsLoading(false);

              if (status === window.google.maps.places.PlacesServiceStatus.OK && Array.isArray(predictions)) {
                const formatted = predictions.map((p) => ({
                  placeId: p.place_id,
                  description: p.description,
                  mainText: p.structured_formatting?.main_text || p.description,
                  secondaryText: p.structured_formatting?.secondary_text || "",
                  types: p.types || [],
                }));
                placesCache.set(cacheKey, {
                  suggestions: formatted,
                  expiresAt: Date.now() + CACHE_TTL_MS,
                });
                setSuggestions(formatted);
              } else if (
                status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS ||
                status === "ZERO_RESULTS"
              ) {
                setSuggestions([]);
              } else {
                // Fallback to backend autocomplete
                fallbackBackendSearch(trimmed, mode, requestId, cacheKey);
              }
            }
          );
        } else {
          // Fallback to backend API
          await fallbackBackendSearch(trimmed, mode, requestId, cacheKey);
        }
      } catch (err) {
        if (requestId === latestRequestRef.current) {
          fallbackBackendSearch(trimmed, mode, requestId, cacheKey);
        }
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, mode, minLength, debounceMs, getSessionToken]);

  const fallbackBackendSearch = async (trimmed, searchMode, requestId, cacheKey) => {
    try {
      const types = searchMode === "city" ? "(cities)" : undefined;
      const res = await customerApi.autocomplete(trimmed, { types });
      if (requestId !== latestRequestRef.current) return;

      const predictions = res.data?.predictions || [];
      const formatted = predictions.map((p) => ({
        placeId: p.place_id,
        description: p.description,
        mainText: p.structured_formatting?.main_text || p.description,
        secondaryText: p.structured_formatting?.secondary_text || "",
        types: p.types || [],
      }));

      placesCache.set(cacheKey, {
        suggestions: formatted,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      setSuggestions(formatted);
      setIsLoading(false);
    } catch (err) {
      if (requestId === latestRequestRef.current) {
        setError(err.message || "Failed to fetch suggestions");
        setSuggestions([]);
        setIsLoading(false);
      }
    }
  };

  /**
   * Resolve a selected place into full address details (city, state, pincode, lat, lng, etc.)
   */
  const resolvePlaceDetails = useCallback(
    async (place) => {
      const placeId = typeof place === "string" ? place : place?.placeId || place?.place_id;
      const description = typeof place === "object" ? place.description || place.mainText : "";

      if (!placeId && !description) {
        throw new Error("Invalid place information");
      }

      resetSessionToken();

      // 1. Try client-side Geocoder
      if (geocoderRef.current && window.google?.maps) {
        try {
          const req = placeId ? { placeId } : { address: description };
          const geocodePromise = new Promise((resolve, reject) => {
            geocoderRef.current.geocode(req, (results, status) => {
              if (status === "OK" && Array.isArray(results) && results[0]) {
                resolve(results[0]);
              } else {
                reject(new Error(`Geocoder status: ${status}`));
              }
            });
          });

          const res = await geocodePromise;
          const loc = res.geometry?.location;
          const lat = typeof loc?.lat === "function" ? loc.lat() : loc?.lat;
          const lng = typeof loc?.lng === "function" ? loc.lng() : loc?.lng;
          const parsed = parseGoogleAddressComponents(res.address_components || [], res.formatted_address);

          return {
            placeId: res.place_id || placeId,
            formattedAddress: res.formatted_address || description,
            address: parsed.streetAddress || res.formatted_address || description,
            city: parsed.city,
            state: parsed.state,
            pincode: parsed.pincode,
            landmark: parsed.landmark,
            location: lat && lng ? { lat, lng } : null,
          };
        } catch (err) {
          console.warn("Client geocoding failed, falling back to backend geocode:", err?.message);
        }
      }

      // 2. Fallback to backend geocode endpoint
      try {
        const res = placeId
          ? await customerApi.geocodePlaceId(placeId)
          : await customerApi.geocodeAddress(description);

        const data = res.data?.result || res.data?.data || res.data || {};
        const loc = data.location;

        return {
          placeId: data.placeId || placeId,
          formattedAddress: data.formattedAddress || description,
          address: data.formattedAddress || description,
          city: data.city || "",
          state: data.state || "",
          pincode: data.pincode || "",
          landmark: data.landmark || "",
          location: loc?.lat && loc?.lng ? { lat: loc.lat, lng: loc.lng } : null,
        };
      } catch (backendErr) {
        throw new Error(backendErr.response?.data?.message || "Could not resolve address details");
      }
    },
    [resetSessionToken]
  );

  /**
   * Helper to lookup City and State from a 6-digit Indian PIN code
   */
  const lookupPincode = useCallback(async (pincode) => {
    const pin = String(pincode || "").trim();
    if (!/^\d{6}$/.test(pin)) return null;

    if (geocoderRef.current && window.google?.maps) {
      try {
        const geocodePromise = new Promise((resolve, reject) => {
          geocoderRef.current.geocode(
            {
              componentRestrictions: { postalCode: pin, country: "IN" },
            },
            (results, status) => {
              if (status === "OK" && Array.isArray(results) && results[0]) {
                resolve(results[0]);
              } else {
                reject(new Error(`Pincode lookup status: ${status}`));
              }
            }
          );
        });

        const res = await geocodePromise;
        const parsed = parseGoogleAddressComponents(res.address_components || [], res.formatted_address);
        const loc = res.geometry?.location;
        const lat = typeof loc?.lat === "function" ? loc.lat() : loc?.lat;
        const lng = typeof loc?.lng === "function" ? loc.lng() : loc?.lng;

        return {
          city: parsed.city,
          state: parsed.state,
          pincode: pin,
          location: lat && lng ? { lat, lng } : null,
          formattedAddress: res.formatted_address,
        };
      } catch (err) {
        console.warn("Client pincode lookup failed:", err?.message);
      }
    }

    try {
      const res = await customerApi.geocodeAddress(`${pin}, India`);
      const data = res.data?.result || res.data?.data || {};
      return {
        city: data.city || "",
        state: data.state || "",
        pincode: pin,
        location: data.location || null,
        formattedAddress: data.formattedAddress || "",
      };
    } catch {
      return null;
    }
  }, []);

  /**
   * Helper to detect live location and reverse geocode
   */
  const detectLiveLocation = useCallback(async () => {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined" || !("navigator" in window) || !navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          try {
            if (geocoderRef.current && window.google?.maps) {
              const res = await new Promise((resGeocode, rejGeocode) => {
                geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
                  if (status === "OK" && Array.isArray(results) && results[0]) {
                    resGeocode(results[0]);
                  } else {
                    rejGeocode(new Error(`Reverse geocode status: ${status}`));
                  }
                });
              });

              const parsed = parseGoogleAddressComponents(res.address_components || [], res.formatted_address);
              resolve({
                address: parsed.streetAddress || res.formatted_address,
                landmark: parsed.landmark,
                city: parsed.city,
                state: parsed.state,
                pincode: parsed.pincode,
                location: { lat, lng },
                placeId: res.place_id,
                formattedAddress: res.formatted_address,
              });
              return;
            }

            // Fallback via backend reverse geocode if client maps unavailable
            const fallbackRes = await customerApi.geocodeAddress(`${lat},${lng}`);
            const data = fallbackRes.data?.result || fallbackRes.data?.data || {};
            resolve({
              address: data.formattedAddress || `Lat ${lat.toFixed(4)}, Lng ${lng.toFixed(4)}`,
              landmark: data.landmark || "",
              city: data.city || "",
              state: data.state || "",
              pincode: data.pincode || "",
              location: { lat, lng },
              placeId: data.placeId || "",
              formattedAddress: data.formattedAddress || "",
            });
          } catch (err) {
            resolve({
              address: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
              landmark: "",
              city: "",
              state: "",
              pincode: "",
              location: { lat, lng },
              formattedAddress: "",
            });
          }
        },
        (geoErr) => {
          reject(new Error(geoErr?.message || "Location permission denied or unavailable"));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  return {
    query,
    setQuery,
    suggestions,
    isLoading,
    error,
    isServiceReady,
    resolvePlaceDetails,
    lookupPincode,
    detectLiveLocation,
    clearSuggestions,
  };
};

export default useGooglePlacesAutocomplete;
