import React from "react";
import { Tag, Check, Search } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CouponCarousel from "@/components/CouponCarousel";

/**
 * CheckoutCouponSection
 *
 * Props:
 *   coupons           – array of coupon objects
 *   selectedCoupon    – currently applied coupon or null
 *   manualCode        – string value of the manual code input
 *   onApplyCoupon     – (coupon) => void
 *   onRemoveCoupon    – () => void
 *   onManualCodeChange – (value) => void
 *   isOpen            – boolean — controls the coupon modal
 *   onOpenChange      – (open) => void
 *   onApplyManualCode – () => void — triggered when user clicks CHECK
 */
const CheckoutCouponSection = React.memo(function CheckoutCouponSection({
  coupons,
  selectedCoupon,
  manualCode,
  onApplyCoupon,
  onRemoveCoupon,
  onManualCodeChange,
  isOpen,
  onOpenChange,
  onApplyManualCode,
}) {
  return (
    <>
      {/* Inline coupon grid */}
      <motion.div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 overflow-hidden w-full box-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Tag size={20} className="text-orange-500" />
            <h3 className="font-black text-slate-800">Available Coupons</h3>
          </div>
          <button
            onClick={() => onOpenChange(true)}
            className="text-primary text-sm font-bold hover:underline">
            See All
          </button>
        </div>
        {coupons.length === 0 ? (
          <p className="text-xs text-slate-400 font-medium py-2">
            No coupons available right now.
          </p>
        ) : (
          <CouponCarousel 
            coupons={coupons}
            selectedCoupon={selectedCoupon}
            onApplyCoupon={onApplyCoupon}
            onRemoveCoupon={onRemoveCoupon}
          />
        )}
      </motion.div>

      {/* Coupon Selection Modal */}
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Apply Coupon</DialogTitle>
            <DialogDescription>Browse available offers and save more.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {coupons.map((coupon) => (
              <div
                key={coupon.code}
                className={`p-4 rounded-2xl border-2 transition-all relative overflow-hidden ${
                  selectedCoupon?.code === coupon.code
                    ? "border-primary bg-brand-50 shadow-sm"
                    : "border-slate-100 bg-white hover:border-slate-200"
                }`}>
                {selectedCoupon?.code === coupon.code && (
                  <div className="absolute top-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-bl-xl">
                    <Check size={12} strokeWidth={4} />
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div
                    className={`p-3 rounded-2xl ${
                      selectedCoupon?.code === coupon.code
                        ? "bg-primary/10 text-primary"
                        : "bg-orange-50 text-orange-500"
                    }`}>
                    <Tag size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-slate-800 tracking-wider mb-1">
                      {coupon.code}
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed mb-3">
                      {coupon.description}
                    </p>
                    <button
                      onClick={() => onApplyCoupon(coupon)}
                      disabled={selectedCoupon?.code === coupon.code}
                      className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
                        selectedCoupon?.code === coupon.code
                          ? "bg-white text-primary border-2 border-primary cursor-default"
                          : "bg-primary text-primary-foreground hover:bg-[#0b721b]"
                      }`}>
                      {selectedCoupon?.code === coupon.code ? "Applied" : "Apply Now"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-2">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <Input
                placeholder="Enter coupon code manually"
                value={manualCode}
                onChange={(e) => onManualCodeChange(e.target.value.toUpperCase())}
                className="pl-10 h-12 rounded-xl focus-visible:ring-primary"
              />
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-primary font-bold text-xs"
                onClick={onApplyManualCode}>
                CHECK
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

export default CheckoutCouponSection;
