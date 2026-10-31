import React from "react";
import { motion } from "framer-motion";
import { Sparkles, Clock } from "lucide-react";
import ProductCard from "../shared/ProductCard";
import {
  getBackgroundColorByValue,
  getBackgroundGradientByValue,
  SIDE_IMAGE_OPTIONS,
} from "@/shared/constants/offerSectionOptions";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";

const ComingSoonSection = ({ config = {}, products = [] }) => {
  if (!config.enabled || !Array.isArray(products) || products.length === 0) {
    return null;
  }

  const bgColor = getBackgroundColorByValue(config.backgroundColor || "#8B5CF6");
  const bgGradient = getBackgroundGradientByValue(config.backgroundColor || "#8B5CF6");
  const sideOpt = SIDE_IMAGE_OPTIONS.find((o) => o.key === config.sideImageKey);

  const sectionProducts = products
    .filter((p) => typeof p === "object" && p !== null)
    .map((p) => {
      const salePrice = Number(p.salePrice || 0);
      const regularPrice = Number(p.price || 0);
      const activePrice = salePrice > 0 ? salePrice : regularPrice;
      const originalPrice = regularPrice > 0 ? regularPrice : activePrice;

      return {
        id: p._id,
        _id: p._id,
        name: p.name,
        image: p.mainImage || p.image || "",
        price: activePrice,
        originalPrice: originalPrice,
        weight: p.weight,
        deliveryTime: p.deliveryTime,
        status: "coming_soon",
      };
    });

  if (sectionProducts.length === 0) return null;

  return (
    <div className="w-full px-0 pt-0 pb-2 md:pb-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.4 }}
        className="mb-4 rounded-none overflow-hidden shadow-[0_18px_35px_rgba(15,23,42,0.16)] bg-white border-y border-slate-100/70 border-x-0 md:border-x relative group"
      >
        <div
          className="relative flex items-center justify-between px-5 md:px-8 py-5 md:py-6 text-black"
          style={{
            backgroundColor: bgColor,
            backgroundImage: bgGradient,
          }}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -left-10 w-40 h-40 md:w-56 md:h-56 bg-white/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 right-0 w-44 h-44 bg-white/10 rounded-full blur-3xl" />
          </div>

          <div className="flex-1 pr-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-black/70 animate-pulse" />
              <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-black/70">
                Coming Soon · Exclusive Preview
              </p>
            </div>
            <h3 className="text-lg md:text-[22px] font-bold tracking-tight leading-tight drop-shadow-sm font-['Inter']">
              {config.title || "Coming Soon"}
            </h3>
            {config.subtitle && (
              <p className="text-[11px] md:text-xs font-semibold text-black/75 mt-1">
                {config.subtitle}
              </p>
            )}
          </div>

          <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl flex-shrink-0 shadow-[0_16px_30px_rgba(0,0,0,0.25)] border border-black/10 overflow-hidden relative bg-black/10 transition-transform hover:-translate-y-1 hover:rotate-[-4deg] hover:scale-105">
            {sectionProducts[0]?.image ? (
              <>
                <img
                  src={applyCloudinaryTransform(sectionProducts[0].image, "f_auto,q_auto,w_150")}
                  alt={config.title || "Coming Soon"}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-black/20 to-transparent" />
                <div className="absolute -bottom-6 -right-6 w-16 h-16 rounded-full bg-purple-400/60 blur-xl mix-blend-screen" />
              </>
            ) : sideOpt?.imageUrl ? (
              <>
                <img
                  src={sideOpt.imageUrl}
                  alt={config.title || "Coming Soon"}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-black/50 via-transparent to-transparent" />
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-indigo-500 to-purple-600" />
            )}

            {sectionProducts.length > 0 && (
              <div className="absolute top-1 left-1 px-2 py-0.5 rounded-full bg-black/70 text-[9px] font-semibold text-white/90 tracking-wide flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400" />
                {sectionProducts.length} items
              </div>
            )}

            <div className="relative z-10 flex items-center justify-center h-full">
              <Sparkles
                className="text-purple-200 drop-shadow-[0_0_12px_rgba(192,132,252,0.9)]"
                size={30}
              />
            </div>
          </div>
        </div>

        <div className="px-4 pt-4 md:px-5 md:pt-5 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {sectionProducts.map((product) => (
              <div key={product.id || product._id} className="w-full">
                <ProductCard
                  product={product}
                  className="h-full bg-white border border-slate-100 shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
                  compact
                />
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default React.memo(ComingSoonSection);

