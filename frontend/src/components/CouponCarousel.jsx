import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Mousewheel } from 'swiper/modules';

import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

export default function CouponCarousel({
  coupons = [],
  selectedCoupon = null,
  onApplyCoupon = () => {},
  onRemoveCoupon = () => {}
}) {
  if (!coupons || coupons.length === 0) {
    return (
      <p className="text-xs text-slate-400 font-medium py-2">
        No coupons available right now.
      </p>
    );
  }

  return (
    <div className="w-full relative">
      <Swiper
        modules={[Navigation, Pagination, Mousewheel]}
        spaceBetween={16}
        slidesPerView={1}
        grabCursor={true}
        mousewheel={{
          forceToAxis: true,
        }}
        breakpoints={{
          320: {
            slidesPerView: 1,
            spaceBetween: 12,
          },
          768: {
            slidesPerView: 2,
            spaceBetween: 16,
          },
        }}
      >
        {coupons.map((coupon) => (
          <SwiperSlide key={coupon.id || coupon.code}>
            <div style={{
              border: "2px dashed #FF6B35",
              borderRadius: "12px",
              padding: "16px",
              backgroundColor: "#FFF5E6",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: "100%"
            }}>
              <div>
                <h3 style={{ color: "#FF6B35", margin: "0 0 8px", textTransform: "uppercase", fontWeight: "bold" }}>
                  {coupon.code}
                </h3>
                <p style={{ fontSize: "18px", fontWeight: "bold", margin: "0 0 4px" }}>
                  {coupon.discount}
                </p>
                <p style={{ color: "#666", fontSize: "12px", margin: "0", textTransform: "uppercase" }}>
                  {coupon.description}
                </p>
              </div>
              <button 
                onClick={() => {
                  console.log("🎫 Coupon object:", coupon);
                  console.log("🎫 Coupon code:", coupon.code);
                  
                  // Call the parent's onApply function with the full object
                  onApplyCoupon(coupon);
                }}
                style={{
                  backgroundColor: "#3B9FD9",
                  color: "white",
                  border: "none",
                  padding: "10px 16px",
                  borderRadius: "24px",
                  cursor: "pointer",
                  marginTop: "12px"
                }}
              >
                Apply
              </button>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
