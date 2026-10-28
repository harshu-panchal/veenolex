import { useEffect, useState } from "react";
import { customerApi } from "../services/customerApi";

/**
 * Ask whether we can deliver to a point.
 *
 * The storefront is deliberately browsable from anywhere, so serviceability is
 * only checked where it changes what the customer can do: at checkout, and
 * when they pick a new delivery address. Until coordinates are known the hook
 * reports `unknown` rather than guessing, so the UI can stay quiet instead of
 * warning someone who simply has not shared a location yet.
 *
 * @param {{latitude?: number, longitude?: number} | null} location
 * @returns {{status: "unknown"|"checking"|"serviceable"|"unserviceable"|"error",
 *            serviceable: boolean|null, detail: object|null}}
 */
export default function useServiceability(location) {
  const lat = Number(location?.latitude);
  const lng = Number(location?.longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  const [state, setState] = useState({
    status: "unknown",
    serviceable: null,
    detail: null,
  });

  useEffect(() => {
    if (!hasCoords) {
      setState({ status: "unknown", serviceable: null, detail: null });
      return undefined;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, status: "checking" }));

    customerApi
      .checkServiceability({ lat, lng })
      .then((res) => {
        if (cancelled) return;
        const result = res?.data?.result || {};
        const serviceable = Boolean(result.serviceable);
        setState({
          status: serviceable ? "serviceable" : "unserviceable",
          serviceable,
          detail: result,
        });
      })
      .catch(() => {
        if (cancelled) return;
        // A failed check must never block checkout — the order flow has its
        // own server-side validation. Stay quiet rather than warn wrongly.
        setState({ status: "error", serviceable: null, detail: null });
      });

    return () => {
      cancelled = true;
    };
  }, [hasCoords, lat, lng]);

  return state;
}
