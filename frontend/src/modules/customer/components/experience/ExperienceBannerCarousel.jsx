import React from "react";
import { cn } from "@/lib/utils";
import { motion, useMotionValue } from "framer-motion";
import {
  applyCloudinaryTransform,
  buildCloudinarySrcSet,
  isCloudinaryUrl,
} from "@/core/utils/imageUtils";

import { isMobileOrWebView } from "@/core/utils/deviceUtils";

const BANNER_CHUNK_SIZE = 20;

const ExperienceBannerCarousel = ({ section, items, fullWidth = false, slideGap = 0, edgeToEdge = false }) => {
  if (!items.length) return null;

  const [activeIndex, setActiveIndex] = React.useState(0);
  const [visibleCount, setVisibleCount] = React.useState(() =>
    Math.min(items.length, BANNER_CHUNK_SIZE)
  );
  const visibleItems = items.slice(0, visibleCount);
  const totalItems = visibleItems.length;
  const x = useMotionValue(0);
  const containerRef = React.useRef(null);
  const hasMore = visibleCount < items.length;

  const loadMore = React.useCallback(() => {
    setVisibleCount((prev) => Math.min(items.length, prev + BANNER_CHUNK_SIZE));
  }, [items.length]);

  React.useEffect(() => {
    setVisibleCount(Math.min(items.length, BANNER_CHUNK_SIZE));
    setActiveIndex(0);
  }, [items.length]);

  // Auto-play logic
  React.useEffect(() => {
    if (totalItems <= 1) return;

    const intervalId = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % totalItems);
    }, 4500);

    return () => clearInterval(intervalId);
  }, [totalItems]);

  React.useEffect(() => {
    if (!hasMore) return;
    if (activeIndex >= totalItems - 2) {
      loadMore();
    }
  }, [activeIndex, totalItems, hasMore, loadMore]);

  const handleDragEnd = (_, info) => {
    const threshold = 50;
    if (info.offset.x < -threshold) {
      // Swipe left -> Next
      setActiveIndex((prev) => Math.min(prev + 1, totalItems - 1));
    } else if (info.offset.x > threshold) {
      // Swipe right -> Prev
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  const getBannerOptimizedSrc = React.useCallback((url) => {
    if (!url) return url;
    if (!isCloudinaryUrl(url)) return url;
    return applyCloudinaryTransform(url, "f_auto,q_auto,c_fill,g_north,w_1448,h_650");
  }, []);

  return (
    <div className={cn("overflow-hidden touch-pan-y", fullWidth && "w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]")}>
      <motion.div
        ref={containerRef}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        animate={{ x: `-${(activeIndex / totalItems) * 100}%` }}
        transition={isMobileOrWebView() ? { type: "tween", ease: "easeInOut", duration: 0.3 } : { type: "spring", stiffness: 300, damping: 30 }}
        className="flex"
        style={{ width: `${totalItems * 100}%` }}
      >
        {visibleItems.map((banner, idx) => (
          <div
            key={idx}
            className={cn(
              "relative shrink-0 flex items-center justify-center box-border",
              fullWidth
                ? "aspect-[1448/650] w-full rounded-none px-0 overflow-hidden"
                : "w-full px-4 md:px-8 overflow-visible pb-6"
            )}
            style={{ width: `${100 / totalItems}%` }}
          >
            {fullWidth ? (
              <img
                src={getBannerOptimizedSrc(banner.imageUrl)}
                srcSet={
                  isCloudinaryUrl(banner.imageUrl)
                    ? buildCloudinarySrcSet(banner.imageUrl, [
                        { w: 412, h: 185 },
                        { w: 824, h: 370 },
                        { w: 1248, h: 560 },
                      ], "f_auto,q_auto,c_fill,g_north")
                    : undefined
                }
                sizes="100vw"
                alt={banner.title || section?.title || "Banner"}
                className="w-full h-full object-cover object-top pointer-events-none"
                width={1448}
                height={650}
                loading={idx === 0 ? "eager" : "lazy"}
                fetchPriority={idx === 0 ? "high" : "low"}
                decoding="async"
              />
            ) : (
              <div className="w-full aspect-[1448/650] rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.05),_0_2px_8px_rgba(0,0,0,0.03)] bg-white relative">
                <img
                  src={getBannerOptimizedSrc(banner.imageUrl)}
                  srcSet={
                    isCloudinaryUrl(banner.imageUrl)
                      ? buildCloudinarySrcSet(banner.imageUrl, [
                          { w: 560, h: 251 },
                          { w: 1120, h: 503 },
                        ], "f_auto,q_auto,c_fill,g_north")
                      : undefined
                  }
                  sizes="(max-width: 768px) 100vw, 1448px"
                  alt={banner.title || section?.title || "Banner"}
                  className="w-full h-full object-cover object-top pointer-events-none rounded-3xl"
                  width={1448}
                  height={650}
                  loading={idx === 0 ? "eager" : "lazy"}
                  fetchPriority={idx === 0 ? "high" : "low"}
                  decoding="async"
                />
                {/* Subtle green border overlay */}
                <div className="absolute inset-0 border border-[#2E7D32]/15 rounded-3xl pointer-events-none" />
              </div>
            )}
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default ExperienceBannerCarousel;
