import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin } from "lucide-react";
import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input";
import { toast } from "sonner";

import { useAuth } from "@core/context/AuthContext";
import { deliveryApi } from "../../services/deliveryApi";
import DeliveryAvatar from "../../components/DeliveryAvatar";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toFormState = (user) => ({
  name: user?.name || "",
  phone: user?.phone || "",
  email: user?.email || "",
  address: user?.address || "",
  currentArea: user?.currentArea || "",
});

const PersonalDetails = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState(() => toFormState(user));

  // The profile arrives asynchronously; re-seed the form once it lands so
  // the fields are never stuck on the empty initial render.
  useEffect(() => {
    if (!isEditing) setFormData(toFormState(user));
  }, [user, isEditing]);

  const handlePhotoUpload = async (file) => {
    try {
      setIsUploadingPhoto(true);
      const fd = new FormData();
      fd.append("profileImage", file);
      await deliveryApi.updateProfile(fd);
      await refreshUser();
      toast.success("Profile photo updated successfully!");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update profile photo");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const partnerId = user?._id ? String(user._id).slice(-6).toUpperCase() : "--";

  const initials =
    (user?.name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "DP";

  const setField = (field) => (event) => {
    const { value } = event.target;
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleCancel = () => {
    setFormData(toFormState(user));
    setErrors({});
    setIsEditing(false);
  };

  const handleSave = async () => {
    const next = {};
    if (!formData.name.trim()) next.name = "Name is required";
    if (formData.email.trim() && !EMAIL_PATTERN.test(formData.email.trim())) {
      next.email = "Enter a valid email address";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      setIsSaving(true);
      await deliveryApi.updateProfile({
        name: formData.name.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        currentArea: formData.currentArea.trim(),
      });
      await refreshUser();
      setIsEditing(false);
      toast.success("Personal details updated");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to update personal details",
      );
    } finally {
      setIsSaving(false);
    }
  };

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
          <h1 className="ds-h3 text-gray-900">Personal Details</h1>
          <div className="ml-auto flex items-center gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="text-gray-500 h-8 px-3"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="h-8 px-3"
                >
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
        {/* Profile Photo */}
        <div className="flex flex-col items-center justify-center py-6">
          <DeliveryAvatar
            src={user?.profileImage}
            name={user?.name}
            size="xl"
            className="p-1 bg-white shadow-md"
            canUpload={true}
            onUpload={handlePhotoUpload}
            isUploading={isUploadingPhoto}
          />
          <p className="mt-3 text-sm text-gray-500">
            Delivery Partner ID: {partnerId}
          </p>
          <span
            className={`mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
              user?.isVerified
                ? "bg-brand-50 text-brand-600"
                : "bg-amber-50 text-amber-600"
            }`}
          >
            {user?.isVerified ? "Verified" : "Pending verification"}
          </span>
        </div>

        {/* Form Fields */}
        <div className="space-y-4 bg-white p-4 rounded-xl shadow-sm">
          <Input
            label="Full Name"
            value={formData.name}
            readOnly={!isEditing}
            onChange={setField("name")}
            error={errors.name}
            className={!isEditing ? "bg-gray-50 border-transparent" : ""}
          />

          <Input
            label="Phone Number"
            value={formData.phone}
            readOnly
            className="bg-gray-50 border-transparent text-gray-500"
            helperText="Contact support to change your phone number"
          />

          <Input
            label="Email Address"
            type="email"
            value={formData.email}
            readOnly={!isEditing}
            onChange={setField("email")}
            error={errors.email}
            placeholder={isEditing ? "you@example.com" : "Not provided"}
            className={!isEditing ? "bg-gray-50 border-transparent" : ""}
          />

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Address
            </label>
            <div className="relative">
              <div className="absolute top-2.5 left-0 pl-3 flex items-start pointer-events-none text-gray-400">
                <MapPin size={18} />
              </div>
              <textarea
                value={formData.address}
                readOnly={!isEditing}
                onChange={setField("address")}
                placeholder={isEditing ? "House / street / city / PIN" : "Not provided"}
                className={`w-full pl-10 pr-4 py-2 rounded-xl text-sm border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none ${
                  !isEditing
                    ? "bg-gray-50 border-transparent text-gray-600"
                    : "bg-white border-gray-200"
                }`}
                rows={3}
              />
            </div>
          </div>

          <Input
            label="Current Service Area"
            value={formData.currentArea}
            readOnly={!isEditing}
            onChange={setField("currentArea")}
            placeholder={isEditing ? "e.g. Dharampeth, Nagpur" : "Not set"}
            helperText="Used to match you with nearby orders"
            className={!isEditing ? "bg-gray-50 border-transparent" : ""}
          />
        </div>
      </div>
    </div>
  );
};

export default PersonalDetails;
