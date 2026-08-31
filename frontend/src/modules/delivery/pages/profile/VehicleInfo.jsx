import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Truck, ShieldCheck, FileText, AlertCircle, Clock } from "lucide-react";
import Button from "@/shared/components/ui/Button";
import Card from "@/shared/components/ui/Card";
import Input from "@/shared/components/ui/Input";
import { toast } from "sonner";
import { useAuth } from "@core/context/AuthContext";
import { useSettings } from "@core/context/SettingsContext";
import { deliveryApi } from "../../services/deliveryApi";

const VEHICLE_TYPES = ["bike", "scooter", "cycle"];

const toFormState = (user) => ({
  vehicleType: user?.vehicleType || "bike",
  vehicleNumber: user?.vehicleNumber || "",
  drivingLicenseNumber: user?.drivingLicenseNumber || "",
});

const VehicleInfo = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { settings } = useSettings();
  const appName = settings?.appName || "App";

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(() => toFormState(user));

  useEffect(() => {
    if (!isEditing) setForm(toFormState(user));
  }, [user, isEditing]);

  const setField = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await deliveryApi.updateProfile({
        vehicleType: form.vehicleType,
        vehicleNumber: form.vehicleNumber.trim().toUpperCase(),
        drivingLicenseNumber: form.drivingLicenseNumber.trim().toUpperCase(),
      });
      await refreshUser();
      setIsEditing(false);
      toast.success("Vehicle details updated");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to update vehicle details",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Document verification is an account-level flag on the Delivery record —
  // there is no per-document review state in the backend yet, so both rows
  // report the same status rather than claiming a fake per-file one.
  const isVerified = Boolean(user?.isVerified);
  const documents = [
    {
      title: "Driving License",
      number: user?.drivingLicenseNumber || "Not provided",
      uploaded: Boolean(user?.documents?.drivingLicense),
    },
    {
      title: "Vehicle Registration",
      number: user?.vehicleNumber || "Not provided",
      uploaded: Boolean(user?.vehicleNumber),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center p-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors mr-2"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="ds-h3 text-gray-900">Vehicle Information</h1>
          <div className="ml-auto flex items-center gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                  className="text-gray-500 h-8 px-3"
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-8 px-3">
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="text-primary hover:bg-primary/5"
              >
                Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-6">
        {/* Vehicle Card */}
        <Card className="p-5 bg-gradient-to-br from-gray-900 to-gray-800 text-white border-none shadow-xl">
          <div className="flex justify-between items-start mb-6">
            <div className="min-w-0">
              <p className="text-gray-400 text-xs uppercase tracking-wider font-bold mb-1">
                Vehicle Details
              </p>
              <h3 className="text-2xl font-bold truncate">
                {user?.vehicleNumber || "Not assigned"}
              </h3>
              <p className="text-gray-300 capitalize">
                {user?.vehicleType || "Not specified"}
              </p>
            </div>
            <div className="bg-white/10 p-2 rounded-full backdrop-blur-sm shrink-0">
              <Truck size={24} className="text-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
            <div className="min-w-0">
              <p className="text-gray-400 text-xs">Driving License</p>
              <p className="font-medium truncate">
                {user?.drivingLicenseNumber || "Not provided"}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Account Status</p>
              <p className="font-medium">{isVerified ? "Verified" : "Pending review"}</p>
            </div>
          </div>
        </Card>

        {/* Edit form */}
        {isEditing && (
          <div className="space-y-4 bg-white p-4 rounded-xl shadow-sm">
            <div className="w-full space-y-1">
              <label className="block text-sm font-medium text-gray-700">Vehicle Type</label>
              <select
                value={form.vehicleType}
                onChange={setField("vehicleType")}
                className="w-full px-3 py-2 rounded-xl text-sm border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all capitalize"
              >
                {VEHICLE_TYPES.map((type) => (
                  <option key={type} value={type} className="capitalize">
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Vehicle Number"
              value={form.vehicleNumber}
              onChange={setField("vehicleNumber")}
              placeholder="e.g. MH31AB1234"
              className="uppercase"
            />
            <Input
              label="Driving License Number"
              value={form.drivingLicenseNumber}
              onChange={setField("drivingLicenseNumber")}
              placeholder="e.g. MH3120210001234"
              className="uppercase"
            />
          </div>
        )}

        {/* Documents List */}
        <div>
          <h3 className="ds-h4 text-gray-900 mb-3 px-1">Vehicle Documents</h3>
          <div className="space-y-3">
            {documents.map((doc) => (
              <Card key={doc.title} className="p-4 border border-gray-100">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-start min-w-0">
                    <div className="p-2 rounded-lg mr-3 bg-brand-50 text-brand-600 shrink-0">
                      <FileText size={20} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-gray-800 text-sm">{doc.title}</h4>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{doc.number}</p>
                    </div>
                  </div>
                  {isVerified && doc.uploaded ? (
                    <div className="flex items-center text-brand-600 bg-brand-50 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shrink-0">
                      <ShieldCheck size={12} className="mr-1" /> Verified
                    </div>
                  ) : (
                    <div className="flex items-center text-amber-600 bg-amber-50 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shrink-0">
                      <Clock size={12} className="mr-1" />
                      {doc.uploaded ? "In review" : "Missing"}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="bg-brand-50 p-4 rounded-xl flex items-start">
          <AlertCircle size={20} className="text-brand-600 mr-3 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-brand-800">
            Changes to your vehicle details are re-checked by the {appName} team.
            Carry your original documents if you are asked to visit a Partner Center.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VehicleInfo;
