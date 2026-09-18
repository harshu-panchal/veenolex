import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../shared/ProductCard';
import { ChevronRight, ChevronLeft } from 'lucide-react';

const ProductRow = ({ title, subtitle, products, badge }) => {
    const scrollRef = useRef(null);

    const scroll = (direction) => {
        if (scrollRef.current) {
            const scrollAmount = direction === "left" ? -340 : 340;
            scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
        }
    };

    if (!products || products.length === 0) return null;

    return (
        <section className="py-8 bg-white overflow-hidden relative group">
            <div className="container w-full max-w-[1920px] mx-auto px-4 md:px-[50px] relative">
                <div className="flex items-center justify-between mb-6 group/title cursor-pointer">
                    <div className="text-left">
                        {badge && (
                            <span className="text-[10px] font-black text-primary-foreground bg-primary px-2 py-0.5 rounded uppercase tracking-widest mb-1 inline-block">
                                {badge}
                            </span>
                        )}
                        <h2 className="text-lg md:text-[22px] font-bold text-black tracking-tight flex items-center gap-2 font-['Inter']">
                            {title}
                            <ChevronRight size={18} className="text-primary group-hover/title:translate-x-1 transition-transform" />
                        </h2>
                        {subtitle && <p className="text-slate-500 font-medium text-sm md:text-base">{subtitle}</p>}
                    </div>
                    <Link to="/categories" className="text-sm font-bold text-primary hover:underline whitespace-nowrap">
                        See All
                    </Link>
                </div>

                {/* Left Navigation Arrow */}
                <button
                    type="button"
                    onClick={() => scroll("left")}
                    aria-label="Scroll left"
                    className="absolute left-1 md:left-4 top-[60%] -translate-y-1/2 z-30 h-10 w-10 bg-white/95 backdrop-blur-md shadow-lg rounded-full flex items-center justify-center border border-slate-200/80 cursor-pointer hover:bg-white text-slate-800 transition-all hover:scale-110 active:scale-95">
                    <ChevronLeft size={22} strokeWidth={2.5} />
                </button>

                {/* Right Navigation Arrow */}
                <button
                    type="button"
                    onClick={() => scroll("right")}
                    aria-label="Scroll right"
                    className="absolute right-1 md:right-4 top-[60%] -translate-y-1/2 z-30 h-10 w-10 bg-white/95 backdrop-blur-md shadow-lg rounded-full flex items-center justify-center border border-slate-200/80 cursor-pointer hover:bg-white text-slate-800 transition-all hover:scale-110 active:scale-95">
                    <ChevronRight size={22} strokeWidth={2.5} />
                </button>

                <div
                    ref={scrollRef}
                    className="flex gap-2 md:gap-6 overflow-x-auto pb-1.5 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 scroll-smooth snap-x">
                    {products.map((product) => (
                        <div key={product.id} className="min-w-[126px] sm:min-w-[136px] md:min-w-[260px] snap-start">
                            <ProductCard product={product} compact={true} />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default ProductRow;

