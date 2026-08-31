import React, { useState, useEffect } from "react";
import { Camera, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const getPartnerInitials = (name) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "DP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export const normalizeImageUrl = (src) => {
  if (!src || typeof src !== "string") return null;
  const trimmed = src.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return null;
  return trimmed;
};

export const DeliveryAvatar = ({
  src,
  name,
  size = "md",
  className = "",
  textClassName = "",
  onClick,
  canUpload = false,
  onUpload,
  isUploading = false,
  alt,
}) => {
  const [hasError, setHasError] = useState(false);
  const normalizedSrc = normalizeImageUrl(src);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const initials = getPartnerInitials(name);

  const sizeClasses = {
    sm: "w-9 h-9 text-xs",
    md: "w-12 h-12 text-base",
    lg: "w-20 h-20 text-2xl",
    xl: "w-24 h-24 text-3xl",
  };

  const currentSizeClass = sizeClasses[size] || sizeClasses.md;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onUpload) {
      onUpload(file);
    }
  };

  return (
    <div className="relative inline-block shrink-0">
      <div
        onClick={onClick}
        className={cn(
          "rounded-full overflow-hidden flex items-center justify-center select-none transition-all duration-200",
          currentSizeClass,
          normalizedSrc && !hasError
            ? "bg-gray-100"
            : "bg-gradient-to-br from-primary/90 to-primary text-white shadow-inner font-black tracking-wider",
          onClick && "cursor-pointer active:scale-95",
          className
        )}
      >
        {normalizedSrc && !hasError ? (
          <img
            src={normalizedSrc}
            alt={alt || name || "Profile"}
            onError={() => setHasError(true)}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className={cn("leading-none", textClassName)}>
            {initials}
          </span>
        )}
      </div>

      {canUpload && (
        <label className="absolute bottom-0 right-0 p-1.5 bg-white text-gray-700 hover:text-primary rounded-full shadow-md border border-gray-200 cursor-pointer hover:bg-gray-50 transition-all active:scale-90 z-10">
          {isUploading ? (
            <Loader2 size={14} className="animate-spin text-primary" />
          ) : (
            <Camera size={14} />
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      )}
    </div>
  );
};

export default DeliveryAvatar;
