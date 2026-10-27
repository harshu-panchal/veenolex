import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MapPin, Navigation } from "lucide-react";
import { useLocation as useAppLocation } from "../../context/LocationContext";

const SESSION_KEY = "location_prompt_shown";
const PROMPT_DELAY_MS = 2500;

const alreadyPrompted = () => {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
};

const markPrompted = () => {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // Private mode: the prompt just shows again next navigation.
  }
};

/**
 * Nudges the customer to share their location once per session when the app
 * has none. Without one we cannot tell where to deliver, so the prompt offers
 * both ways to fix that: enable access, or type the address in the profile.
 */
const LocationEnablePrompt = () => {
  const { hasRealLocation, refreshLocation, isFetchingLocation } = useAppLocation();
  const navigate = useNavigate();
  const timerRef = useRef(null);

  useEffect(() => {
    if (hasRealLocation || alreadyPrompted()) return undefined;

    timerRef.current = setTimeout(() => {
      markPrompted();
      toast.custom(
        (id) => (
          <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                <MapPin size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900">
                  Turn on your location
                </h3>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  We need it to show what is deliverable to you and where to send
                  your order. You can also enter your address manually.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isFetchingLocation}
                    onClick={async () => {
                      const result = await refreshLocation();
                      toast.dismiss(id);
                      if (result?.ok) {
                        toast.success("Location enabled");
                      } else {
                        toast.error(
                          result?.error ||
                            "Location access is blocked. Enter your address manually instead.",
                        );
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-60"
                  >
                    <Navigation size={13} />
                    Enable location
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      toast.dismiss(id);
                      navigate("/profile", { state: { openLocationModal: true } });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700"
                  >
                    Enter manually
                  </button>
                </div>
              </div>
            </div>
          </div>
        ),
        { duration: 12000, position: "bottom-center" },
      );
    }, PROMPT_DELAY_MS);

    return () => clearTimeout(timerRef.current);
  }, [hasRealLocation, isFetchingLocation, refreshLocation, navigate]);

  return null;
};

export default LocationEnablePrompt;
