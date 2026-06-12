import React, { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";

const QuickCategorySlider = ({ categories, onCategoryClick }) => {
  const scrollRef = useRef(null);
  const navigate = useNavigate();

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === "left" ? -300 : 300;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  if (!categories || categories.length === 0) return null;

  return (
    <div className="w-full mb-0 mt-8 md:mt-12 overflow-hidden relative group z-20 font-['Inter'] bg-[#FAF9F4] pt-0 pb-5 md:pb-6">
      <div className="container mx-auto px-4 md:px-8 lg:px-[50px] relative">
        
        <div className="flex justify-between items-center mb-6 md:mb-8 px-1">
          <h2 className="text-lg md:text-[22px] font-bold tracking-tight text-black leading-none font-['Inter']">
            Shop by Categories
          </h2>
          <button
            onClick={() => navigate("/categories")}
            className="flex items-center gap-0.5 text-xs font-bold text-brand-600 hover:opacity-80 transition-opacity cursor-pointer leading-none">
            View All
            <ChevronRight size={12} strokeWidth={3} className="ml-0.5" />
          </button>
        </div>

        {/* Left Scroll Button */}
        <div className="absolute left-1 top-[60%] -translate-y-1/2 z-20 hidden md:flex">
          <button
            onClick={() => scroll("left")}
            className="h-8 w-8 bg-white/90 backdrop-blur-md shadow-md rounded-full flex items-center justify-center border border-gray-100 cursor-pointer hover:bg-white text-primary transition-all active:scale-90">
            <ChevronLeft size={18} strokeWidth={3} />
          </button>
        </div>

        {/* Categories container */}
        <div
          ref={scrollRef}
          className="relative z-10 flex items-start gap-4 md:gap-6 overflow-x-auto no-scrollbar pb-2 pt-1 snap-x scroll-smooth">
          {categories.map((cat) => {
            return (
              <div
                key={cat.id}
                onClick={() => onCategoryClick(cat.id)}
                className="flex flex-col items-center cursor-pointer group/item snap-start min-w-[70px] sm:min-w-[88px] max-w-[96px] transition-transform active:scale-95">
                
                {/* Styled Circle Container */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#FFFFFF] border border-[#E7DDD5] flex items-center justify-center transition-all duration-300 group-hover/item:scale-105 group-hover/item:border-[#d0bfb2] shadow group-hover/item:shadow-md">
                  {cat.icon || cat.image ? (
                    <img
                      src={applyCloudinaryTransform(cat.icon || cat.image, "f_auto,q_auto,w_150")}
                      alt={cat.name}
                      loading="lazy"
                      className="h-10 w-10 sm:h-12 sm:w-12 object-contain mix-blend-multiply"
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-slate-300" />
                  )}
                </div>

                {/* Text Label Below Circle */}
                <span className="text-center text-[10px] sm:text-[11px] md:text-xs font-bold text-[#374151] line-clamp-2 leading-tight block mt-2.5 w-full px-1 group-hover/item:text-primary transition-colors">
                  {cat.name}
                </span>

              </div>
            );
          })}
        </div>

        {/* Right Scroll Button */}
        <div className="absolute right-1 top-[60%] -translate-y-1/2 z-20 hidden md:flex">
          <button
            onClick={() => scroll("right")}
            className="h-8 w-8 bg-white/90 backdrop-blur-md shadow-md rounded-full flex items-center justify-center border border-gray-100 cursor-pointer hover:bg-white text-primary transition-all active:scale-90">
            <ChevronRight size={18} strokeWidth={3} />
          </button>
        </div>

      </div>
    </div>
  );
};

export default React.memo(QuickCategorySlider);
