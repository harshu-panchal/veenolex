import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import gsap from "gsap";
import Lottie from "lottie-react";
import LocationDrawer from "./LocationDrawer";
import { useLocation } from "../../context/LocationContext";
import { useProductDetail } from "../../context/ProductDetailContext";
import { useSettings } from "@core/context/SettingsContext";
import { cn } from "@/lib/utils";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import {
  buildHeaderGradient,
  buildMiniCartColor,
  buildSearchBarBackgroundColor,
  shiftHex,
} from "../../utils/headerTheme";
import LogoImage from "../../../../assets/Logo.png";

// MUI Icons
import LocationOnIcon from "@mui/icons-material/LocationOn";
import SearchIcon from "@mui/icons-material/Search";
import ChevronDownIcon from "@mui/icons-material/KeyboardArrowDown";
import FavoriteBorderOutlinedIcon from "@mui/icons-material/FavoriteBorderOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";

const SkeletonCategoryBar = () => (
  <div className="flex items-end gap-0 overflow-x-auto no-scrollbar -mx-2 px-2 min-h-[68px] md:min-h-[76px] pt-1 pb-0.5">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="flex flex-col items-center gap-1.5 px-2 min-w-[48px] md:min-w-[58px]">
        <div className="h-9 w-9 md:h-11 md:w-11 rounded-full shimmer-bg" />
        <div className="h-2.5 w-10 rounded-full shimmer-bg mt-1" />
      </div>
    ))}
    <style>{`
      @keyframes shimmer {
        0%   { background-position: -400px 0; }
        100% { background-position:  400px 0; }
      }
      .shimmer-bg {
        background: linear-gradient(
          90deg,
          rgba(0,0,0,0.06) 25%,
          rgba(0,0,0,0.12) 37%,
          rgba(0,0,0,0.06) 63%
        );
        background-size: 800px 100%;
        animation: shimmer 1.4s ease-in-out infinite;
      }
    `}</style>
  </div>
);

function CategoryNavColumn({
  index,
  cat,
  isActive,
  categoryAccent,
  onCategorySelect,
  headerFontColor,
  headerIconColor,
}) {
  const iconColor = headerIconColor || "#111111";
  
  const iconWrapRef = useRef(null);
  const rippleRef = useRef(null);
  const barRef = useRef(null);
  const labelRef = useRef(null);
  const wasActive = useRef(false);

  // 1. MOUNT ENTRANCE
  useEffect(() => {
    gsap.fromTo(
      iconWrapRef.current,
      { y: 12, opacity: 0, scale: 0.75 },
      { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.7)", delay: index * 0.055 }
    );
  }, [index]);

  // 2. ACTIVE STATE SPRING
  useEffect(() => {
    if (isActive !== wasActive.current) {
      if (isActive) {
        gsap.to(iconWrapRef.current, { y: -6, scale: 1.14, ease: "elastic.out(1, 0.4)", duration: 0.5 });
        gsap.fromTo(labelRef.current, { scale: 0.88 }, { scale: 1, ease: "back.out(2)", duration: 0.3 });
        if (barRef.current) {
          gsap.fromTo(barRef.current, 
            { scaleX: 0, opacity: 0 }, 
            { scaleX: 1, opacity: 1, ease: "elastic.out(1, 0.5)", duration: 0.5, transformOrigin: "center center" }
          );
        }
      } else {
        gsap.to(iconWrapRef.current, { y: 0, scale: 1, ease: "power3.out", duration: 0.3 });
        if (barRef.current) {
          gsap.to(barRef.current, { scaleX: 0, opacity: 0, duration: 0.2 });
        }
      }
      wasActive.current = isActive;
    }
  }, [isActive]);

  const handleClick = () => {
    // 3. RIPPLE BURST & 4. PRESS FEEDBACK
    if (rippleRef.current) {
      gsap.fromTo(rippleRef.current,
        { scale: 0, opacity: 0.45 },
        { scale: 2.4, opacity: 0, duration: 0.55, ease: "power2.out" }
      );
    }
    
    const tl = gsap.timeline();
    tl.to(iconWrapRef.current, { scale: 0.87, duration: 0.1, ease: "power2.in" })
      .to(iconWrapRef.current, { scale: 1.13, duration: 0.18, ease: "back.out(2)" })
      .to(iconWrapRef.current, { scale: 1.14, duration: 0.22, ease: "elastic.out(1,0.4)" });

    if (onCategorySelect) onCategorySelect(cat);
  };

  const handleMouseEnter = () => {
    if (!isActive) {
      gsap.to(iconWrapRef.current, { y: -3, scale: 1.07, duration: 0.22, ease: "power2.out" });
    }
  };

  const handleMouseLeave = () => {
    if (!isActive) {
      gsap.to(iconWrapRef.current, { y: 0, scale: 1, duration: 0.28, ease: "power2.out" });
    }
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative z-[2] flex min-w-[48px] shrink-0 cursor-pointer flex-col items-center gap-1.5 px-2 pb-1.5 pt-0.5 snap-start md:min-w-[58px]">
      
      <div className="relative z-10 flex h-9 w-9 md:h-11 md:w-11 items-center justify-center">
        <div ref={rippleRef} className="absolute inset-0 rounded-full" style={{ backgroundColor: categoryAccent, opacity: 0, pointerEvents: 'none' }} />
        <div ref={iconWrapRef} className="relative z-10 flex h-full w-full items-center justify-center bg-white rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-slate-100">
          {typeof cat.icon === "function" ||
            (typeof cat.icon === "object" && cat.icon.$$typeof) ? (
            <cat.icon
              sx={{
                fontSize: { xs: 20, md: 24 },
                color: iconColor,
                opacity: isActive ? 1 : 0.78,
                transition: "opacity 0.2s",
              }}
            />
          ) : (
            <img
              src={applyCloudinaryTransform(cat.icon, "f_auto,q_auto,w_100")}
              alt={cat.name}
              loading="lazy"
              className="h-5 w-5 object-contain md:h-6 md:w-6"
              style={{ opacity: isActive ? 1 : 0.78 }}
            />
          )}
        </div>
      </div>
      <div className="relative mt-px w-full">
        <span
          ref={labelRef}
          className={cn(
            "relative z-10 mx-auto block max-w-[80px] truncate px-1 pb-0.5 text-center text-[10px] font-['Inter'] tracking-tight md:max-w-[96px] md:text-[12px]",
            isActive ? "font-black" : "font-semibold",
          )}
          style={{
            color: isActive ? iconColor : (headerFontColor || "#1e293b"),
            opacity: isActive ? 1 : 0.9,
            fontFamily: "'Inter', sans-serif",
          }}>
          {cat.name}
        </span>
      </div>
      <div
        ref={barRef}
        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-full"
        style={{ backgroundColor: categoryAccent, opacity: 0, transformOrigin: "center center" }}
      />
    </div>
  );
}

function hexToRgba(hex, alpha = 0.95) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#")) {
    return `rgba(46, 125, 50, ${alpha})`;
  }
  const cleanHex = hex.replace("#", "");
  let r = 0, g = 0, b = 0;
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  } else if (cleanHex.length === 6) {
    r = parseInt(cleanHex.slice(0, 2), 16);
    g = parseInt(cleanHex.slice(2, 4), 16);
    b = parseInt(cleanHex.slice(4, 6), 16);
  } else {
    return `rgba(46, 125, 50, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const MainLocationHeader = ({
  categories = [],
  activeCategory,
  onCategorySelect,
  hideSearchBar = false,
  isLoading = false,
}) => {
  const { scrollY } = useScroll();
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [cartAnimData, setCartAnimData] = useState(null);

  // Dynamically load shopping-cart Lottie on mount
  useEffect(() => {
    import("../../../../assets/lottie/shopping-cart.json")
      .then((m) => setCartAnimData(m.default))
      .catch(() => { });
  }, []);
  const { currentLocation, refreshLocation, isFetchingLocation } =
    useLocation();
  const { isOpen: isProductDetailOpen } = useProductDetail();
  const { settings } = useSettings();
  const appName = settings?.appName || "Veenolex";
  const logoUrl = settings?.logoUrl || LogoImage;
  const navigate = useNavigate();

  // Search Logic
  const handleSearchClick = () => {
    navigate("/search");
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      navigate("/search", { state: { query: e.target.value } });
    }
  };

  // Search placeholder animation
  const [searchPlaceholder, setSearchPlaceholder] = useState("Search ");
  const [typingState, setTypingState] = useState({
    textIndex: 0,
    charIndex: 0,
    isDeleting: false,
    isPaused: false,
  });

  const staticText = "Search ";
  const typingPhrases = [
    '"bread"',
    '"milk"',
    '"chocolate"',
    '"eggs"',
    '"chips"',
  ];

  useEffect(() => {
    const { textIndex, charIndex, isDeleting, isPaused } = typingState;
    const currentPhrase = typingPhrases[textIndex];

    if (isPaused) {
      const timeout = setTimeout(() => {
        setTypingState((prev) => ({
          ...prev,
          isPaused: false,
          isDeleting: true,
        }));
      }, 2000); // Pause after full phrase
      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          // Typing
          if (charIndex < currentPhrase.length) {
            setSearchPlaceholder(
              staticText + currentPhrase.substring(0, charIndex + 1),
            );
            setTypingState((prev) => ({
              ...prev,
              charIndex: prev.charIndex + 1,
            }));
          } else {
            // Finished typing
            setTypingState((prev) => ({ ...prev, isPaused: true }));
          }
        } else {
          // Deleting
          if (charIndex > 0) {
            setSearchPlaceholder(
              staticText + currentPhrase.substring(0, charIndex - 1),
            );
            setTypingState((prev) => ({
              ...prev,
              charIndex: prev.charIndex - 1,
            }));
          } else {
            // Finished deleting
            setTypingState((prev) => ({
              ...prev,
              isDeleting: false,
              textIndex: (prev.textIndex + 1) % typingPhrases.length,
            }));
          }
        }
      },
      isDeleting ? 50 : 100,
    ); // 50ms deleting speed, 100ms typing speed

    return () => clearTimeout(timeout);
  }, [typingState]);

  // Header layout properties (fixed, non-collapsible)
  const headerTopPadding = 16;
  const headerBottomPadding = 12;
  const bgOpacity = 0.98;

  const contentHeight = "72px";
  const contentOpacity = 1;
  const navHeight = "60px";
  const navOpacity = 1;
  const navMargin = 4;
  const categorySpacing = 12;
  const cartOpacity = 1;
  const cartScale = 1;

  const displayContent = "block";
  const displayNav = "flex";
  const displayCart = "block";

  const baseHeaderColor = activeCategory?.headerColor || "#2E7D32";
  const rawFontColor = activeCategory?.headerFontColor || "#111827";
  const rawIconColor = activeCategory?.headerIconColor || "#111111";

  const isColorLightOrWhite = (hex) => {
    if (!hex || typeof hex !== "string") return false;
    const cleanHex = hex.replace("#", "").toLowerCase();
    if (cleanHex === "fff" || cleanHex === "ffffff" || cleanHex === "white") return true;
    if (cleanHex.length === 6) {
      const r = parseInt(cleanHex.slice(0, 2), 16);
      const g = parseInt(cleanHex.slice(2, 4), 16);
      const b = parseInt(cleanHex.slice(4, 6), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness > 200;
    }
    return false;
  };

  const headerFontColor = isColorLightOrWhite(rawFontColor) ? "#1f2937" : rawFontColor;
  const headerIconColor = isColorLightOrWhite(rawIconColor) ? "#111111" : rawIconColor;

  const headerGradient = buildHeaderGradient(baseHeaderColor);
  const searchBarBg = buildSearchBarBackgroundColor(baseHeaderColor);
  const categoryAccent = headerIconColor;

  useEffect(() => {
    const c = buildMiniCartColor(baseHeaderColor);
    document.documentElement.style.setProperty("--customer-mini-cart-color", c);
    return () => {
      document.documentElement.style.removeProperty(
        "--customer-mini-cart-color",
      );
    };
  }, [baseHeaderColor]);

  return (
    <>
      <div
        style={{ fontFamily: "'Inter', sans-serif" }}
        className={cn(
          "fixed top-0 left-0 right-0 z-200",
          isProductDetailOpen && "hidden md:block",
        )}>
        <motion.div
          initial={false}
          style={{
            paddingTop: headerTopPadding,
            paddingBottom: headerBottomPadding,
            borderBottomLeftRadius: "24px",
            borderBottomRightRadius: "24px",
            opacity: bgOpacity,
            background: `linear-gradient(135deg, ${hexToRgba(baseHeaderColor, 0.95)} 0%, rgba(255, 255, 255, 0.95) 100%)`,
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
          }}
          className="px-4 shadow-[0_8px_32px_rgba(0,0,0,0.08)] overflow-hidden transform-gpu will-change-transform">
          {/* Subtle Glow Overlay */}
          <div className="absolute inset-0 bg-white/8 pointer-events-none" />

          {/* Corner Lottie */}
          <motion.button
            initial={{ opacity: 0, scale: 0.9, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
            style={{
              opacity: cartOpacity,
              scale: cartScale,
              display: displayCart,
            }}
            type="button"
            aria-label="Open cart"
            onClick={() => navigate("/checkout")}
            className="absolute top-3 right-5 sm:top-4 sm:right-6 md:top-5 md:right-8 z-20 w-12 h-12 sm:w-14 sm:h-14 md:w-20 md:h-20 cursor-pointer transition-transform">
            {cartAnimData ? (
              <Lottie
                animationData={cartAnimData}
                loop
                className="w-full h-full pointer-events-none drop-shadow-[0_8px_18px_rgba(0,0,0,0.16)]"
              />
            ) : (
              <div className="w-full h-full" />
            )}
          </motion.button>

          {/* Desktop/Tablet Header Layout (md and above) */}
          <div className="hidden md:flex items-center justify-between relative z-20 px-2 lg:px-6 mb-4 mt-1">
            {/* Left Section: Logo + Search Bar row */}
            <div className="flex items-center gap-4 lg:gap-8 flex-1 max-w-[450px] lg:max-w-2xl">
              <div
                onClick={() => navigate("/")}
                className="flex items-center gap-3 cursor-pointer group shrink-0">
                <div className="group-hover:scale-110 transition-all duration-300 drop-shadow-[0_2px_8px_rgba(255,255,255,0.15)] shrink-0">
                  <img
                    src={logoUrl}
                    alt={`${appName} Logo`}
                    loading="lazy"
                    className="h-16 md:h-20 w-auto object-contain"
                  />
                </div>
              </div>

              {/* Search Bar (Desktop inline row - replacing address selector) */}
              <div className="flex-1">
                <motion.div
                  onClick={handleSearchClick}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  style={{ backgroundColor: "#FFFFFF" }}
                  className="rounded-full px-5 h-11 shadow-sm hover:shadow-md flex items-center border border-slate-200 hover:border-slate-300/80 transition-all duration-200 focus-within:ring-2 focus-within:ring-primary/40 cursor-pointer">
                  <SearchIcon sx={{ color: "var(--primary, #2E7D32)", fontSize: 20, opacity: 0.8 }} />
                  <input
                    type="text"
                    placeholder={searchPlaceholder || "Search Products..."}
                    readOnly
                    className="flex-1 bg-transparent border-none outline-none pl-3 text-slate-800 font-semibold placeholder:text-slate-400 text-[15px] cursor-pointer"
                  />
                </motion.div>
              </div>
            </div>
          </div>

          {/* Collapsible Delivery Info & Location (MOBILE ONLY) */}
          <div className="md:hidden">
            <motion.div
              style={{
                height: contentHeight,
                opacity: contentOpacity,
                marginBottom: navMargin,
                display: displayContent,
                overflow: "hidden",
              }}
              className="relative z-10 pb-4">
              <div
                className="mb-4 flex items-center justify-between w-full relative z-10"
              >
                {/* Left: Logo */}
                <div
                  onClick={() => navigate("/")}
                  className="cursor-pointer select-none shrink-0"
                >
                  <img
                    src={logoUrl}
                    alt={`${appName} Logo`}
                    loading="lazy"
                    className="h-16 w-auto object-contain transition-all active:scale-95 shrink-0"
                  />
                </div>

                {/* Center: Brand name text */}
                <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
                  <span
                    onClick={() => navigate("/")}
                    style={{ color: headerFontColor }}
                    className="text-sm font-black uppercase tracking-widest transition-colors duration-300 pointer-events-auto cursor-pointer"
                  >
                    {appName}
                  </span>
                </div>

                {/* Right: Spacer to match left logo size, keeping alignment balanced */}
                <div className="w-16 h-16 shrink-0" />
              </div>
            </motion.div>
          </div>

          <div className="relative z-10 mt-1.5 mb-3.5 flex items-center gap-2 md:hidden">
            <motion.div
              onClick={handleSearchClick}
              whileTap={{ scale: 0.98 }}
              style={{ backgroundColor: "#FFFFFF" }}
              className="flex-1 rounded-[12px] px-3.5 h-10 shadow-sm flex items-center border border-slate-200 hover:border-slate-300 transition-all duration-200 focus-within:ring-2 focus-within:ring-primary/40 cursor-pointer">
              <SearchIcon sx={{ color: "var(--primary, #2E7D32)", fontSize: 18, opacity: 0.8 }} />
              <input
                type="text"
                placeholder={searchPlaceholder || "Search Products..."}
                readOnly
                className="flex-1 bg-transparent border-none outline-none pl-2 text-slate-800 font-semibold placeholder:text-slate-400 text-[14px] cursor-pointer"
              />
            </motion.div>
          </div>

          {/* Categories Navigation - Smooth Collapse */}
          {isLoading ? (
            <SkeletonCategoryBar />
          ) : categories.length > 0 && (
            <motion.div
              layout
              transition={{
                layout: {
                  type: "spring",
                  stiffness: 420,
                  damping: 34,
                  mass: 0.6,
                },
              }}
              style={{
                height: navHeight,
                opacity: navOpacity,
                marginTop: categorySpacing,
                display: displayNav,
                overflowY: "hidden",
              }}
              className="relative flex items-end md:justify-start gap-0 overflow-x-auto no-scrollbar -mx-2 px-2 md:mx-0 md:px-2 lg:px-6 z-10 snap-x pt-1 min-h-[68px] md:min-h-[76px] pb-0.5">
              {categories.slice(0, 20).map((cat, index) => {
                const isActive = activeCategory?.id === cat.id;
                return (
                  <CategoryNavColumn
                    key={cat.id}
                    index={index}
                    cat={cat}
                    isActive={isActive}
                    categoryAccent={categoryAccent}
                    onCategorySelect={onCategorySelect}
                    headerFontColor={headerFontColor}
                    headerIconColor={headerIconColor}
                  />
                );
              })}
            </motion.div>
          )}

          {/* Background Decorative patterns */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-[100px] -mr-40 -mt-40 pointer-events-none" />
        </motion.div>
      </div>

      <LocationDrawer
        isOpen={isLocationOpen}
        onClose={() => setIsLocationOpen(false)}
      />
    </>
  );
};

export default MainLocationHeader;

