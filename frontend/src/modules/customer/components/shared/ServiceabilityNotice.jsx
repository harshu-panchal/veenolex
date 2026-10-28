import React from "react";
import { MapPin, AlertTriangle } from "lucide-react";

/**
 * Tells the customer we cannot deliver to the place they have chosen — or
 * that they have not chosen one yet.
 *
 * Browsing the catalogue never needs a location, so this is shown only where
 * the answer changes what happens next: checkout, and the address picker in
 * the profile. It is a notice, not a wall: the customer keeps their cart and
 * can pick a different address.
 */
const ServiceabilityNotice = ({
  status,
  onChangeLocation,
  areaName = "",
  className = "",
}) => {
  if (status !== "unknown" && status !== "unserviceable") return null;

  const needsLocation = status === "unknown";

  const title = needsLocation
    ? "Set your delivery location"
    : "We don't deliver here yet";

  const message = needsLocation
    ? "We need a delivery address before you can place this order."
    : `Ah! We haven't reached ${areaName ? areaName : "your neighborhood"} yet. Try a different address.`;

  const Icon = needsLocation ? MapPin : AlertTriangle;
  const tone = needsLocation
    ? { box: "bg-blue-50 border-blue-200", icon: "text-blue-600", head: "text-blue-900", body: "text-blue-800" }
    : { box: "bg-amber-50 border-amber-200", icon: "text-amber-600", head: "text-amber-900", body: "text-amber-800" };

  return (
    <div className={`border rounded-2xl p-4 ${tone.box} ${className}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0">
          <Icon className={`w-5 h-5 ${tone.icon}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${tone.head}`}>{title}</p>
          <p className={`text-xs mt-1 ${tone.body}`}>{message}</p>
          {typeof onChangeLocation === "function" && (
            <button
              type="button"
              onClick={onChangeLocation}
              className="mt-3 px-4 py-2 bg-white border border-current/20 rounded-xl text-xs font-bold uppercase tracking-wide text-slate-800 hover:bg-slate-50 transition-colors active:scale-[0.98]"
            >
              {needsLocation ? "Set location" : "Change location"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceabilityNotice;
