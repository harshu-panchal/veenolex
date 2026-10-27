import React from "react";
import { Heart } from "lucide-react";
import { motion } from "framer-motion";

/**
 * CheckoutTipSection
 *
 * The tip picker, split out of CheckoutPricingBreakdown so the two-step
 * checkout can place it between the coupons and the payment method while the
 * bill details stay last. The tip still appears as a line item in the
 * breakdown — this component only owns the selector.
 *
 * Props:
 *   selectedTip – number
 *   onSelectTip – (value) => void
 *   tipAmounts  – array of { value, label }
 */
const CheckoutTipSection = React.memo(function CheckoutTipSection({
  selectedTip,
  onSelectTip,
  tipAmounts,
}) {
  return (
    <motion.div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl p-4 border border-pink-100">
      <div className="flex items-center gap-2 mb-3">
        <Heart size={18} className="text-pink-500 fill-pink-500" />
        <h3 className="font-black text-slate-800">Tip your delivery partner</h3>
      </div>
      <p className="text-xs text-slate-600 mb-3">100% of the tip goes to them</p>
      <div className="grid grid-cols-4 gap-2">
        {tipAmounts.map((tip) => (
          <button
            key={tip.value}
            onClick={() => onSelectTip(tip.value)}
            className={`py-2 rounded-xl border-2 transition-all font-bold text-sm ${selectedTip === tip.value
              ? "border-pink-500 bg-pink-100 text-pink-700"
              : "border-pink-200 bg-white text-slate-700 hover:border-pink-300"
              }`}>
            {tip.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
});

export default CheckoutTipSection;
