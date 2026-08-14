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

const ExperienceBannerCarousel = ({ section, items, fullWidth = true, slideGap = 0, edgeToEdge = true }) => {
  if (!items.length) return null;

  const [activeIndex, setActiveIndex] = React.useState(0);
  const [isMobile, setIsMobile] = React.useState(true);

  React.useEffect(() => {
    const checkDevice = () => {
      setIsMobile(isMobileOrWebView());
    };
    checkDevice();
    window.addEventListener("resize", checkDevice);
    return () => window.removeEventListener("resize", checkDevice);
  }, []);

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

    const interval = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % totalItems;
        if (next >= visibleCount - 2 && hasMore) {
          loadMore();
        }
        return next;
      });
    }, 4500);

    return () => clearInterval(interval);
  }, [totalItems, visibleCount, hasMore, loadMore]);

  const handleDragEnd = (event, info) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset < -50 || velocity < -500) {
      if (activeIndex < totalItems - 1) {
        const next = activeIndex + 1;
        setActiveIndex(next);
        if (next >= visibleCount - 2 && hasMore) {
          loadMore();
        }
      }
    } else if (offset > 50 || velocity > 500) {
      if (activeIndex > 0) {
        setActiveIndex(activeIndex - 1);
      }
    }
  };

  const getBannerOptimizedSrc = React.useCallback((url) => {
    if (!url) return url;
    if (!isCloudinaryUrl(url)) return url;
    return applyCloudinaryTransform(url, "f_auto,q_auto,w_1448");
  }, []);

  return (
    <div className="relative w-full overflow-hidden py-1">
      <motion.div
        ref={containerRef}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        animate={{ x: `-${(activeIndex / totalItems) * 100}%` }}
        transition={isMobileOrWebView() ? { type: "tween", ease: "easeInOut", duration: 0.3 } : { type: "spring", stiffness: 300, damping: 30 }}
        className="flex"
        style={{ width: `${totalItems * 100}%` }}
      >
        {visibleItems.map((banner, idx) => {
          const useDesktopRatio = !isMobile;
          const activeImageUrl = (useDesktopRatio && banner.desktopImageUrl) ? banner.desktopImageUrl : banner.imageUrl;
          const aspectClass = useDesktopRatio
            ? "aspect-[21/7] max-h-[460px]"
            : "aspect-[16/6] sm:aspect-[18/6.5] max-h-[280px]";

          return (
            <div
              key={idx}
              className={cn(
                "relative shrink-0 flex items-center justify-center box-border",
                fullWidth
                  ? "w-full overflow-hidden px-3 sm:px-4 md:px-6 lg:px-8"
                  : "w-full px-3 sm:px-4 overflow-visible pb-4"
              )}
              style={{ width: `${100 / totalItems}%` }}
            >
              {fullWidth ? (
                <div className={cn("w-full box-border flex items-center justify-center", aspectClass)}>
                  <div className="w-full h-full rounded-2xl md:rounded-[2rem] overflow-hidden shadow-md border border-slate-100/80 bg-slate-50 flex items-center justify-center relative">
                    <img
                      src={getBannerOptimizedSrc(activeImageUrl)}
                      srcSet={
                        isCloudinaryUrl(activeImageUrl)
                          ? buildCloudinarySrcSet(
                            activeImageUrl,
                            useDesktopRatio
                              ? [
                                { w: 724 },
                                { w: 1448 },
                                { w: 2172 },
                              ]
                              : [
                                { w: 412 },
                                { w: 824 },
                                { w: 1248 },
                              ],
                            "f_auto,q_auto"
                          )
                          : undefined
                      }
                      sizes="100vw"
                      alt={banner.title || section?.title || "Banner"}
                      className="w-full h-full object-fill pointer-events-none rounded-2xl md:rounded-[2rem] block"
                      loading={idx === 0 ? "eager" : "lazy"}
                      fetchPriority={idx === 0 ? "high" : "low"}
                      decoding="async"
                    />
                  </div>
                </div>
              ) : (
                <div className={cn("w-full rounded-2xl md:rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.05),_0_2px_8px_rgba(0,0,0,0.03)] bg-slate-50 relative flex items-center justify-center overflow-hidden", aspectClass)}>
                  <img
                    src={getBannerOptimizedSrc(activeImageUrl)}
                    srcSet={
                      isCloudinaryUrl(activeImageUrl)
                        ? buildCloudinarySrcSet(
                          activeImageUrl,
                          useDesktopRatio
                            ? [
                              { w: 724 },
                              { w: 1448 },
                            ]
                            : [
                              { w: 560 },
                              { w: 1120 },
                            ],
                          "f_auto,q_auto"
                        )
                        : undefined
                    }
                    sizes="(max-width: 768px) 100vw, 1448px"
                    alt={banner.title || section?.title || "Banner"}
                    className="w-full h-full object-fill pointer-events-none rounded-2xl md:rounded-3xl block"
                    loading={idx === 0 ? "eager" : "lazy"}
                    fetchPriority={idx === 0 ? "high" : "low"}
                    decoding="async"
                  />
                  {/* Subtle brand border overlay */}
                  <div className="absolute inset-0 border border-primary/15 rounded-2xl md:rounded-3xl pointer-events-none" />
                </div>
              )}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
};

export default ExperienceBannerCarousel;
