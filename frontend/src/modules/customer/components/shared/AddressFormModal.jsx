import React, { useState, useEffect, useRef } from "react";
import {
  MapPin,
  Building,
  Navigation,
  Loader2,
  Check,
  Search,
  Crosshair,
  Home,
  Briefcase,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useGooglePlacesAutocomplete } from "@/hooks/useGooglePlacesAutocomplete";

export const AddressFormModal = ({
  isOpen,
  onClose,
  initialData = null,
  title = "Add New Address",
  description = "Enter your delivery details below.",
  onSave,
  defaultName = "",
  defaultPhone = "",
}) => {
  const [formData, setFormData] = useState({
    type: "home",
    name: "",
    phone: "",
    address: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
    location: null,
    placeId: "",
  });

  const [saving, setSaving] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Address Autocomplete Hook
  const {
    query: addressQuery,
    setQuery: setAddressQuery,
    suggestions: addressSuggestions,
    isLoading: isAddressLoading,
    resolvePlaceDetails,
    lookupPincode,
    detectLiveLocation,
    clearSuggestions: clearAddressSuggestions,
  } = useGooglePlacesAutocomplete({ mode: "address" });

  // City Autocomplete Hook
  const {
    query: cityQuery,
    setQuery: setCityQuery,
    suggestions: citySuggestions,
    isLoading: isCityLoading,
    clearSuggestions: clearCitySuggestions,
  } = useGooglePlacesAutocomplete({ mode: "city" });

  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const addressDropdownRef = useRef(null);
  const cityDropdownRef = useRef(null);

  // Populate or reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          type: (initialData.type || initialData.label || "home").toLowerCase(),
          name: initialData.name ?? defaultName ?? "",
          phone: initialData.phone ?? defaultPhone ?? "",
          address: initialData.address || initialData.fullAddress || "",
          landmark: initialData.landmark ?? "",
          city: initialData.city ?? "",
          state: initialData.state ?? "",
          pincode: initialData.pincode ?? "",
          location: initialData.location || null,
          placeId: initialData.placeId || "",
        });
      } else {
        setFormData({
          type: "home",
          name: defaultName || "",
          phone: defaultPhone || "",
          address: "",
          landmark: "",
          city: "",
          state: "",
          pincode: "",
          location: null,
          placeId: "",
        });
      }
      setAddressQuery("");
      setCityQuery("");
      clearAddressSuggestions();
      clearCitySuggestions();
      setShowAddressDropdown(false);
      setShowCityDropdown(false);
    }
  }, [isOpen, initialData, defaultName, defaultPhone]);

  // Handle Address change & typing
  const handleAddressInputChange = (e) => {
    const val = e.target.value;
    setFormData((prev) => ({ ...prev, address: val }));
    setAddressQuery(val);
    setShowAddressDropdown(true);
  };

  // Handle Address suggestion click
  const handleSelectAddressSuggestion = async (suggestion) => {
    setShowAddressDropdown(false);
    clearAddressSuggestions();

    try {
      toast.loading("Fetching address details...", { id: "addr-load" });
      const details = await resolvePlaceDetails(suggestion);
      toast.dismiss("addr-load");

      setFormData((prev) => ({
        ...prev,
        address: details.formattedAddress || details.address || suggestion.description,
        city: details.city || prev.city,
        state: details.state || prev.state,
        pincode: details.pincode || prev.pincode,
        landmark: details.landmark || prev.landmark,
        location: details.location || prev.location,
        placeId: details.placeId || suggestion.placeId,
      }));
    } catch (err) {
      toast.dismiss("addr-load");
      setFormData((prev) => ({
        ...prev,
        address: suggestion.description,
        placeId: suggestion.placeId,
      }));
    }
  };

  // Handle City change & typing
  const handleCityInputChange = (e) => {
    const val = e.target.value;
    setFormData((prev) => ({ ...prev, city: val }));
    setCityQuery(val);
    setShowCityDropdown(true);
  };

  // Handle City suggestion click
  const handleSelectCitySuggestion = async (suggestion) => {
    setShowCityDropdown(false);
    clearCitySuggestions();

    try {
      toast.loading("Updating state & city...", { id: "city-load" });
      const details = await resolvePlaceDetails(suggestion);
      toast.dismiss("city-load");

      setFormData((prev) => ({
        ...prev,
        city: details.city || suggestion.mainText || suggestion.description,
        state: details.state || prev.state,
        pincode: details.pincode || prev.pincode,
        location: details.location || prev.location,
      }));
    } catch (err) {
      toast.dismiss("city-load");
      setFormData((prev) => ({
        ...prev,
        city: suggestion.mainText || suggestion.description,
      }));
    }
  };

  // Handle Pincode change & auto lookup
  const handlePincodeChange = async (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setFormData((prev) => ({ ...prev, pincode: val }));

    if (val.length === 6) {
      try {
        const pinDetails = await lookupPincode(val);
        if (pinDetails) {
          setFormData((prev) => ({
            ...prev,
            city: prev.city || pinDetails.city,
            state: prev.state || pinDetails.state,
            location: prev.location || pinDetails.location,
          }));
          toast.success(`Matched: ${pinDetails.city}, ${pinDetails.state}`);
        }
      } catch {
        // ignore
      }
    }
  };

  // Handle Detect Live Location (GPS)
  const handleDetectGPS = async () => {
    setIsDetectingLocation(true);
    try {
      toast.loading("Detecting your location...", { id: "gps-load" });
      const live = await detectLiveLocation();
      toast.dismiss("gps-load");

      setFormData((prev) => ({
        ...prev,
        address: live.address || prev.address,
        landmark: live.landmark || prev.landmark,
        city: live.city || prev.city,
        state: live.state || prev.state,
        pincode: live.pincode || prev.pincode,
        location: live.location || prev.location,
        placeId: live.placeId || prev.placeId,
      }));
      toast.success("Location detected successfully!");
    } catch (err) {
      toast.dismiss("gps-load");
      toast.error(err.message || "Failed to detect location");
    } finally {
      setIsDetectingLocation(false);
    }
  };

  // Handle Form Submission
  const handleSubmit = async () => {
    const address = formData.address?.trim();
    const city = formData.city?.trim();
    const state = formData.state?.trim();
    const pincode = formData.pincode?.trim();
    const name = formData.name?.trim();
    const phone = formData.phone?.trim();

    if (!address) {
      toast.error("Please enter your address");
      return;
    }

    if (!city) {
      toast.error("Please enter or select a city");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...formData,
        address,
        city,
        state,
        pincode,
        name,
        phone,
      });
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to save address");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !saving && !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[92vh] flex flex-col p-5 rounded-2xl overflow-hidden shadow-2xl">
        {/* Fixed Header */}
        <DialogHeader className="pb-2 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold text-slate-900">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            {description}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto pr-1 py-3 space-y-3 custom-modal-scroll">
          {/* Quick GPS Location Button + Address Type in a sleek row */}
          <div className="flex items-center gap-2">
            {/* Address Type Selector */}
            <div className="flex bg-slate-100 p-1 rounded-xl flex-1 gap-1">
              <button
                type="button"
                onClick={() => setFormData((f) => ({ ...f, type: "home" }))}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  formData.type === "home"
                    ? "bg-white text-primary shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Home size={13} /> Home
              </button>
              <button
                type="button"
                onClick={() => setFormData((f) => ({ ...f, type: "work" }))}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  formData.type === "work"
                    ? "bg-white text-primary shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Briefcase size={13} /> Work
              </button>
              <button
                type="button"
                onClick={() => setFormData((f) => ({ ...f, type: "other" }))}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  formData.type === "other"
                    ? "bg-white text-primary shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Layers size={13} /> Other
              </button>
            </div>

            {/* Use GPS Button */}
            <button
              type="button"
              onClick={handleDetectGPS}
              disabled={isDetectingLocation || saving}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-brand-50 border border-brand-200/70 text-primary hover:bg-brand-100 text-xs font-bold transition-all flex-shrink-0 group shadow-sm"
              title="Detect current GPS location"
            >
              {isDetectingLocation ? (
                <Loader2 size={13} className="animate-spin text-primary" />
              ) : (
                <Crosshair size={13} className="text-primary group-hover:rotate-45 transition-transform" />
              )}
              <span>{isDetectingLocation ? "Detecting..." : "Use GPS"}</span>
            </button>
          </div>

          {/* Contact Details (2 columns) */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="grid gap-1">
              <Label htmlFor="addr-name" className="text-[11px] font-semibold text-slate-700">
                Full Name
              </Label>
              <Input
                id="addr-name"
                placeholder="Receiver name"
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="addr-phone" className="text-[11px] font-semibold text-slate-700">
                Phone Number
              </Label>
              <Input
                id="addr-phone"
                placeholder="10-digit number"
                value={formData.phone}
                onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Address with Google Places Autocomplete */}
          <div className="relative grid gap-1" ref={addressDropdownRef}>
            <div className="flex items-center justify-between">
              <Label htmlFor="addr-address" className="text-[11px] font-semibold text-slate-700">
                Complete Address <span className="text-red-500">*</span>
              </Label>
              {isAddressLoading && (
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" /> Searching...
                </span>
              )}
            </div>

            <Textarea
              id="addr-address"
              placeholder="Flat no, building, street, area..."
              value={formData.address}
              onChange={handleAddressInputChange}
              onFocus={() => {
                if (addressSuggestions.length > 0) setShowAddressDropdown(true);
              }}
              className="text-xs rounded-xl resize-none min-h-[52px] h-[52px] py-1.5"
            />

            {/* Address Suggestions Dropdown */}
            {showAddressDropdown && addressSuggestions.length > 0 && (
              <div className="absolute top-[100%] left-0 right-0 z-50 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl max-h-[190px] overflow-y-auto divide-y divide-slate-100">
                {addressSuggestions.map((sug) => (
                  <div
                    key={sug.placeId}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectAddressSuggestion(sug);
                    }}
                    className="p-2 hover:bg-brand-50 cursor-pointer flex items-start gap-2 transition-colors"
                  >
                    <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600 flex-shrink-0 mt-0.5">
                      <MapPin size={13} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{sug.mainText}</p>
                      {sug.secondaryText && (
                        <p className="text-[10px] text-slate-500 truncate">{sug.secondaryText}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Nearest Landmark & Pincode (2 columns) */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="grid gap-1">
              <Label htmlFor="addr-landmark" className="text-[11px] font-semibold text-slate-700">
                Nearest Landmark <span className="text-slate-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="addr-landmark"
                placeholder="e.g. Near City Mall"
                value={formData.landmark}
                onChange={(e) => setFormData((f) => ({ ...f, landmark: e.target.value }))}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="grid gap-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="addr-pincode" className="text-[11px] font-semibold text-slate-700">
                  Pincode
                </Label>
                <span className="text-[9px] text-slate-400">6 digits</span>
              </div>
              <Input
                id="addr-pincode"
                placeholder="e.g. 452009"
                value={formData.pincode}
                onChange={handlePincodeChange}
                maxLength={6}
                className="h-9 text-xs rounded-xl font-mono tracking-wider"
              />
            </div>
          </div>

          {/* City & State with City Autocomplete (2 columns) */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="relative grid gap-1" ref={cityDropdownRef}>
              <div className="flex items-center justify-between">
                <Label htmlFor="addr-city" className="text-[11px] font-semibold text-slate-700">
                  City <span className="text-red-500">*</span>
                </Label>
                {isCityLoading && <Loader2 size={10} className="animate-spin text-slate-400" />}
              </div>
              <Input
                id="addr-city"
                placeholder="Type city (e.g. Indore)"
                value={formData.city}
                onChange={handleCityInputChange}
                onFocus={() => {
                  if (citySuggestions.length > 0) setShowCityDropdown(true);
                }}
                className="h-9 text-xs rounded-xl"
              />

              {/* City Suggestions Dropdown */}
              {showCityDropdown && citySuggestions.length > 0 && (
                <div className="absolute bottom-[100%] sm:bottom-auto sm:top-[100%] left-0 right-0 z-50 mb-1 sm:mb-0 sm:mt-1 bg-white rounded-xl border border-slate-200 shadow-xl max-h-[170px] overflow-y-auto divide-y divide-slate-100">
                  {citySuggestions.map((citySug) => (
                    <div
                      key={citySug.placeId}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectCitySuggestion(citySug);
                      }}
                      className="p-2 hover:bg-brand-50 cursor-pointer flex items-start gap-2 transition-colors"
                    >
                      <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600 flex-shrink-0 mt-0.5">
                        <Building size={13} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{citySug.mainText}</p>
                        {citySug.secondaryText && (
                          <p className="text-[10px] text-slate-500 truncate">{citySug.secondaryText}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-1">
              <Label htmlFor="addr-state" className="text-[11px] font-semibold text-slate-700">
                State
              </Label>
              <Input
                id="addr-state"
                placeholder="Auto-updated"
                value={formData.state}
                onChange={(e) => setFormData((f) => ({ ...f, state: e.target.value }))}
                className="h-9 text-xs rounded-xl bg-slate-50/70"
              />
            </div>
          </div>
        </div>

        {/* Fixed Footer with Save Button Always Visible */}
        <DialogFooter className="pt-3 border-t border-slate-100 flex-row gap-2 justify-end flex-shrink-0 bg-white">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl text-xs h-9 px-4"
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-primary hover:bg-[#0b721b] text-white rounded-xl text-xs font-bold h-9 px-5 shadow-md shadow-primary/20"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 size={13} className="animate-spin mr-1.5" /> Saving...
              </>
            ) : (
              "Save Address"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddressFormModal;

