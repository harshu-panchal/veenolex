import React from "react";
import { useSettings } from "@core/context/SettingsContext";

const PromoMarquee = () => {
  const { settings, loading } = useSettings();

  // If loading or settings are not available yet, do not render to avoid flashing layout
  if (loading) return null;

  const messages = settings?.promoMessages;

  // If no configured promo messages, hide the marquee completely
  if (!Array.isArray(messages) || messages.length === 0) {
    return null;
  }

  // Ensure we repeat the list of messages enough times to create a continuous marquee loop
  const repeatedMessages = [];
  const repeatCount = Math.max(2, Math.ceil(8 / messages.length));
  for (let i = 0; i < repeatCount; i++) {
    repeatedMessages.push(...messages);
  }

  return (
    <div className="w-full -mt-[2px] md:-mt-[2px] mb-4">
      <div 
        style={{ backgroundColor: "#2E7D32", borderColor: "#236326" }}
        className="relative overflow-hidden border-y shadow-[0_10px_30px_rgba(15,23,42,0.08)]"
      >
        <div className="classic-marquee-track flex w-max items-center gap-4 px-3 py-1.5 text-sm font-semibold text-white -translate-y-[5px] md:px-6 md:py-2 md:text-base">
          {repeatedMessages.map((message, idx) => (
            <React.Fragment key={`${message}-${idx}`}>
              <span className="whitespace-nowrap text-white">{message}</span>
              <span className="text-white/60">•</span>
            </React.Fragment>
          ))}
          <span className="whitespace-nowrap">❤️</span>
          <span className="whitespace-nowrap">🎁</span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PromoMarquee);
