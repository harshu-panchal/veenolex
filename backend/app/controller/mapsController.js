import handleResponse from "../utils/helper.js";
import { geocodeAddress, geocodePlaceId } from "../services/mapsGeocodeService.js";
import axios from "axios";

export const geocodeAddressController = async (req, res) => {
  try {
    const address = String(req.query.address || "").trim();
    const placeId = String(req.query.placeId || "").trim();
    const country = req.query.country ? String(req.query.country).trim() : undefined;

    if (!placeId && (!address || address.length < 3)) {
      return handleResponse(res, 400, "address or placeId query param is required", {
        error: { code: "ADDRESS_REQUIRED", message: "address query param is required" },
      });
    }

    const result = placeId
      ? await geocodePlaceId(placeId)
      : await geocodeAddress(address, { country });

    return handleResponse(res, 200, "Geocoded", {
      location: { lat: result.lat, lng: result.lng },
      formattedAddress: result.formattedAddress,
      placeId: result.placeId,
      types: result.types,
      city: result.city || "",
      state: result.state || "",
      pincode: result.pincode || "",
      landmark: result.landmark || "",
    });
  } catch (e) {
    const status = e.statusCode || 500;
    return handleResponse(res, status, e.message || "Geocoding failed", {
      error: {
        code: e.code || "GEOCODE_FAILED",
        message: e.message || "Geocoding failed",
      },
    });
  }
};

export const autocompleteAddressController = async (req, res) => {
  try {
    const input = String(req.query.input || "").trim();
    const types = req.query.types ? String(req.query.types).trim() : undefined;
    if (!input || input.length < 3) {
      return handleResponse(res, 400, "input query param is required and must be at least 3 characters", {
        error: { code: "INPUT_REQUIRED", message: "input query param is required" },
      });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim() || process.env.GOOGLE_MAPS_SERVER_KEY?.trim() || "";
    if (!apiKey) {
      return handleResponse(res, 500, "Google Maps API key missing on server", {
        error: { code: "MAPS_KEY_MISSING", message: "Google Maps API key missing" },
      });
    }

    const params = {
      input,
      key: apiKey,
      components: "country:in",
      language: "en",
    };
    if (types) {
      params.types = types;
    }

    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/autocomplete/json",
      {
        params,
        timeout: 10000,
      }
    );

    return handleResponse(res, 200, "Autocomplete suggestions fetched", response.data);
  } catch (e) {
    const status = e.response?.status || 500;
    return handleResponse(res, status, e.message || "Autocomplete failed", {
      error: {
        code: "AUTOCOMPLETE_FAILED",
        message: e.message || "Autocomplete failed",
      },
    });
  }
};
