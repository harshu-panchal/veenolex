import React from "react";
import { ChevronRight } from "lucide-react";
import ProductCard from "../shared/ProductCard";

const LowestPriceSection = ({ products, onSeeAll }) => {
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

          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5">
            {products.slice(0, 10).map((product) => (
              <div key={product.id || product._id} className="w-full">
                <ProductCard
                  product={product}
                  className="h-full bg-white shadow-[0_8px_20px_-8px_rgba(0,0,0,0.1)] md:shadow-[0_15px_30px_rgba(0,0,0,0.05)] border-brand-50/50 md:border-slate-100 transition-all"
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
