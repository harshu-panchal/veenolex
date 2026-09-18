import React, { useRef } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import ProductCard from "../shared/ProductCard";

const LowestPriceSection = ({ products, onSeeAll }) => {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === "left" ? -340 : 340;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  if (!products || products.length === 0) return null;

  return (
    <div className="mt-0 mb-4 md:mt-0 md:mb-8 relative group">
      <div className="pt-5 pb-2 md:pt-6 md:pb-4">
        <div className="container mx-auto px-4 md:px-8 lg:px-[50px] relative z-10">
          <div className="flex justify-between items-center mb-6 md:mb-8 px-1">
            <div className="flex flex-col">
              <h3 className="text-lg md:text-[22px] font-bold tracking-tight text-black leading-none font-['Inter']">
                Today's Best Prices
              </h3>
            </div>
            <button
              onClick={onSeeAll}
              className="flex items-center gap-0.5 text-xs font-bold text-brand-600 hover:opacity-80 transition-opacity cursor-pointer leading-none">
              View All
              <ChevronRight size={12} strokeWidth={3} className="ml-0.5" />
            </button>
          </div>

          {/* Left Arrow Button */}
          <button
            type="button"
            onClick={() => scroll("left")}
            aria-label="Scroll left"
            className="absolute left-1 md:left-4 top-[60%] -translate-y-1/2 z-30 h-10 w-10 bg-white/95 backdrop-blur-md shadow-lg rounded-full flex items-center justify-center border border-slate-200/80 cursor-pointer hover:bg-white text-slate-800 transition-all hover:scale-110 active:scale-95">
            <ChevronLeft size={22} strokeWidth={2.5} />
          </button>

          {/* Right Arrow Button */}
          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label="Scroll right"
            className="absolute right-1 md:right-4 top-[60%] -translate-y-1/2 z-30 h-10 w-10 bg-white/95 backdrop-blur-md shadow-lg rounded-full flex items-center justify-center border border-slate-200/80 cursor-pointer hover:bg-white text-slate-800 transition-all hover:scale-110 active:scale-95">
            <ChevronRight size={22} strokeWidth={2.5} />
          </button>

          <div
            ref={scrollRef}
            className="relative z-10 flex overflow-x-auto gap-3 md:gap-6 pb-2 md:pb-3 no-scrollbar snap-x snap-mandatory scroll-smooth">
            {products.slice(0, 12).map((product) => (
              <div key={product.id} className="w-[148px] sm:w-[164px] md:w-[260px] shrink-0 snap-start smooth-transform">
                <ProductCard
                  product={product}
                  className="bg-white shadow-[0_8px_20px_-8px_rgba(0,0,0,0.1)] md:shadow-[0_15px_30px_rgba(0,0,0,0.05)] border-brand-50/50 md:border-slate-100 transition-all"
                  compact={true}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(LowestPriceSection);
