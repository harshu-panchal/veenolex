import React, { useState, useRef } from "react";
import { Check, Contact2, MapPin, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useGooglePlacesAutocomplete } from "@/hooks/useGooglePlacesAutocomplete";

/**
 * CheckoutAddressSection
 *
 * Props:
 *   currentAddress       – the active delivery address object
 *   savedRecipient       – "order for someone else" recipient object or null
 *   savedAddresses       – array of saved addresses from LocationContext
 *   onSelectAddress      – () => void  — opens the address-selection modal
 *   onEditAddress        – () => void  — opens the edit-address modal
 *   onUseCurrentLocation – () => void  — triggers live-location detection
 *
 * Internal state for the "order for someone else" form is kept here because
 * it is purely presentational; the parent only needs the saved result.
 */
const CheckoutAddressSection = React.memo(function CheckoutAddressSection({
  currentAddress,
  savedRecipient,
  savedAddresses,
  onSelectAddress,
  onEditAddress,
  onUseCurrentLocation,
  // Extra props forwarded from CheckoutPage that the section needs
  isFetchingLocation,
  showRecipientForm,
  onToggleRecipientForm,
  recipientData,
  onRecipientDataChange,
  onSaveRecipient,
  onRemoveRecipient,
  displayName,
  displayPhone,
  displayAddress,
}) {
  const [showRecipientSuggestions, setShowRecipientSuggestions] = useState(false);
  const {
    setQuery: setRecipientQuery,
    suggestions: recipientSuggestions,
    isLoading: isRecipientLoading,
    resolvePlaceDetails,
    clearSuggestions: clearRecipientSuggestions,
  } = useGooglePlacesAutocomplete({ mode: "address" });

  const handleSelectRecipientSuggestion = async (sug) => {
    setShowRecipientSuggestions(false);
    clearRecipientSuggestions();
    try {
      const details = await resolvePlaceDetails(sug);
      onRecipientDataChange({
        ...recipientData,
        completeAddress: details.formattedAddress || sug.description,
        pincode: details.pincode || recipientData.pincode,
        landmark: details.landmark || recipientData.landmark,
        location: details.location || null,
        placeId: details.placeId || sug.placeId,
      });
    } catch {
      onRecipientDataChange({
        ...recipientData,
        completeAddress: sug.description,
        placeId: sug.placeId,
      });
    }
  };

  return (
    <motion.div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      {/* "Order for someone else" toggle */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs text-slate-500 font-medium">
          Ordering for someone else?
        </span>
        <button
          onClick={onToggleRecipientForm}
          className="text-primary text-xs font-bold hover:underline">
          {showRecipientForm
            ? "Close"
            : savedRecipient
              ? "Change details"
              : "Add details"}
        </button>
      </div>

      {/* Saved recipient card */}
      {savedRecipient && !showRecipientForm && (
        <div className="mb-4 p-4 bg-brand-50 border border-brand-100 rounded-2xl flex items-start justify-between">
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center text-primary flex-shrink-0">
              <Contact2 size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                {savedRecipient.name}
              </p>
              <p className="text-xs text-primary font-bold mb-1">
                {savedRecipient.phone}
              </p>
              <p className="text-xs text-slate-500 leading-tight">
                {savedRecipient.completeAddress}
                {savedRecipient.landmark && `, ${savedRecipient.landmark}`}
                {savedRecipient.pincode && ` - ${savedRecipient.pincode}`}
              </p>
            </div>
          </div>
          <button
            onClick={onRemoveRecipient}
            className="text-red-500 text-xs font-bold hover:underline">
            Remove
          </button>
        </div>
      )}

      {/* Recipient form */}
      <AnimatePresence>
        {showRecipientForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden mb-4">
            <div className="bg-[#f8f9fb] rounded-2xl p-4 border border-slate-100 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-800">
                    Enter delivery address details
                  </h4>
                  {isRecipientLoading && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Loader2 size={10} className="animate-spin" /> Searching...
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="relative">
                    <Input
                      placeholder="Start typing address (e.g. flat, area, street)*"
                      value={recipientData.completeAddress}
                      onChange={(e) => {
                        onRecipientDataChange({ ...recipientData, completeAddress: e.target.value });
                        setRecipientQuery(e.target.value);
                        setShowRecipientSuggestions(true);
                      }}
                      onFocus={() => {
                        if (recipientSuggestions.length > 0) setShowRecipientSuggestions(true);
                      }}
                      className="h-12 rounded-xl border-slate-200 focus:ring-primary focus:border-primary text-sm"
                    />

                    {showRecipientSuggestions && recipientSuggestions.length > 0 && (
                      <div className="absolute top-[100%] left-0 right-0 z-50 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl max-h-[200px] overflow-y-auto divide-y divide-slate-100">
                        {recipientSuggestions.map((sug) => (
                          <div
                            key={sug.placeId}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectRecipientSuggestion(sug);
                            }}
                            className="p-2.5 hover:bg-brand-50 cursor-pointer flex items-start gap-2.5 transition-colors"
                          >
                            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600 flex-shrink-0 mt-0.5">
                              <MapPin size={14} className="text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{sug.mainText}</p>
                              {sug.secondaryText && (
                                <p className="text-[11px] text-slate-500 truncate">{sug.secondaryText}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Input
                    placeholder="Find landmark (optional)"
                    value={recipientData.landmark}
                    onChange={(e) =>
                      onRecipientDataChange({ ...recipientData, landmark: e.target.value })
                    }
                    className="h-12 rounded-xl border-slate-200 focus:ring-primary focus:border-primary text-sm"
                  />
                  <Input
                    placeholder="Enter pin code (optional)"
                    value={recipientData.pincode}
                    onChange={(e) =>
                      onRecipientDataChange({ ...recipientData, pincode: e.target.value })
                    }
                    className="h-12 rounded-xl border-slate-200 focus:ring-primary focus:border-primary text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-1">
                  Enter receiver details
                </h4>
                <p className="text-[10px] text-slate-400 mb-3 font-medium">
                  We&apos;ll contact receiver to get the exact delivery address
                </p>
                <div className="space-y-3">
                  <Input
                    placeholder="Receiver's name*"
                    value={recipientData.name}
                    onChange={(e) =>
                      onRecipientDataChange({ ...recipientData, name: e.target.value })
                    }
                    className="h-12 rounded-xl border-slate-200 focus:ring-primary focus:border-primary text-sm"
                  />
                  <div className="relative">
                    <Input
                      placeholder="Receiver's phone number*"
                      value={recipientData.phone}
                      onChange={(e) =>
                        onRecipientDataChange({ ...recipientData, phone: e.target.value })
                      }
                      className="h-12 rounded-xl border-slate-200 focus:ring-primary focus:border-primary text-sm pr-10"
                    />
                    <Contact2
                      size={18}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={onSaveRecipient}
                className="w-full h-12 bg-[var(--brand-700)] hover:bg-[var(--brand-600)] text-white font-bold rounded-xl">
                Save address
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delivery address heading */}
      <div className="mb-3">
        <h3 className="font-black text-slate-800 text-base">Delivery Address</h3>
        <p className="text-xs text-slate-500">Select or edit your saved address</p>
      </div>

      {/* Active address card */}
      <div className="border rounded-xl p-3 mb-3 relative cursor-pointer transition-all border-primary bg-brand-50/50">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
              <Check size={12} className="text-white stroke-[4]" />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <h4 className="font-bold text-slate-800 text-sm">{displayName}</h4>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onEditAddress(); }}
                  className="text-slate-500 text-xs font-bold hover:underline">
                  Edit
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onSelectAddress(); }}
                  className="text-primary text-xs font-bold hover:underline">
                  Change
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{displayPhone}</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{displayAddress}</p>
          </div>
        </div>
      </div>

      {/* Use current location */}
      <button
        type="button"
        onClick={onUseCurrentLocation}
        disabled={isFetchingLocation}
        className="mt-3 w-full py-2.5 rounded-2xl border border-dashed border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
        {isFetchingLocation ? "Detecting live location..." : "Use current live location"}
      </button>

      {/* Confirmation banner */}
      <motion.div className="mt-3 rounded-2xl border border-brand-100 bg-brand-50/70 px-4 py-3 flex items-center gap-3 shadow-sm">
        <div className="h-8 w-8 rounded-full bg-black  flex items-center justify-center shadow-brand-500/40 shadow-md">
          <Check size={16} className="text-white stroke-[3]" />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-brand-900">
            Delivery address confirmed
          </p>
          <p className="text-[11px] font-medium text-brand-800/80">
            We&apos;ll deliver to the address you&apos;ve entered above.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
});

export default CheckoutAddressSection;
