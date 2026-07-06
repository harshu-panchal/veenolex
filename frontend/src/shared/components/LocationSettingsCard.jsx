import React from "react";
import Card from "./ui/Card";
import Button from "./ui/Button";
import { MapPin, Shield } from "lucide-react";

const LocationSettingsCard = ({
  formData,
  isEditing,
  setIsEditing,
  setIsMapOpen,
  entityType = "seller", // "seller" | "admin"
}) => {
  const isAdmin = entityType === "admin";

  return (
    <Card className="p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-lg">
      <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-4">
        <h3 className="text-xl font-black text-slate-900">
          Location & Service Settings
        </h3>
        {!isEditing && (
          <Button
            type="button"
            onClick={() => setIsEditing(true)}
            className="bg-slate-900 text-white hover:bg-black rounded-lg px-6 py-2 text-[10px] font-black tracking-[2px]"
          >
            MANAGE
          </Button>
        )}
      </div>

      <div className="space-y-6">
        <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-100/50 space-y-6">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div
                className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all ${
                  formData.lat
                    ? "bg-brand-100 text-brand-600 shadow-[0_8px_20px_-6px_rgba(16,185,129,0.3)]"
                    : "bg-white text-slate-400 shadow-sm"
                }`}
              >
                <MapPin size={24} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-slate-900">
                  {formData.lat
                    ? (isAdmin ? "Warehouse Location Pin" : "Store Location Pin")
                    : "Location Not Defined"}
                </p>
                <p className="text-xs text-slate-500 font-medium max-w-[400px] leading-relaxed">
                  {formData.address ||
                    `Click change to precisely mark your ${isAdmin ? "warehouse" : "shop"} location on the map for delivery accuracy.`}
                </p>
              </div>
            </div>
            {isEditing && (
              <Button
                type="button"
                onClick={() => setIsMapOpen(true)}
                className="bg-white text-slate-900 border-2 border-slate-200 hover:border-slate-900 rounded-lg px-8 py-3 text-[10px] font-black tracking-[2px] shadow-sm hover:shadow-md transition-all whitespace-nowrap"
              >
                CHANGE PIN
              </Button>
            )}
          </div>

          {formData.lat && (
            <div className="pt-6 border-t border-slate-200/60 flex flex-wrap gap-8">
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  Service Radius
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-slate-900">
                    {formData.radius}
                  </span>
                  <span className="text-xs font-bold text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded-md">
                    KM
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  Latitude
                </span>
                <span className="text-sm font-bold text-slate-700 tabular-nums">
                  {formData.lat.toFixed(6)}
                </span>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  Longitude
                </span>
                <span className="text-sm font-bold text-slate-700 tabular-nums">
                  {formData.lng.toFixed(6)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
          <Shield size={16} className="text-amber-600 mt-0.5" />
          <p className="text-xs text-amber-700 font-medium leading-relaxed">
            Your {isAdmin ? "warehouse" : "shop"} location and service radius determine which
            {isAdmin ? " delivery drivers" : " customers"} can be assigned/reach you. Ensure the marker is placed
            exactly at your physical {isAdmin ? "warehouse" : "storefront"} for accurate delivery
            assignments.
          </p>
        </div>
      </div>
    </Card>
  );
};

export default LocationSettingsCard;
