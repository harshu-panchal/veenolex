import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
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

function CategoryNavColumn({
  cat,
  isActive,
  categoryAccent,
  onCategorySelect,
  headerFontColor,
  headerIconColor,
}) {
  const iconColor = headerIconColor || "#111111";

  return (
    <motion.div
      layout
      whileTap={{ scale: 0.96 }}
      transition={{
        layout: { type: "spring", stiffness: 520, damping: 38, mass: 0.55 },
      }}
      onClick={() => onCategorySelect && onCategorySelect(cat)}
      className="relative z-[2] flex min-w-[48px] shrink-0 cursor-pointer flex-col items-center gap-0.5 px-2 pb-1.5 pt-0.5 snap-start md:min-w-[58px]">
      <div className="relative z-10 flex h-9 w-9 items-center justify-center md:h-11 md:w-11">
        {typeof cat.icon === "function" ||
          (typeof cat.icon === "object" && cat.icon.$$typeof) ? (
          <cat.icon
            sx={{
              fontSize: { xs: 20, md: 24 },
              color: iconColor,
              opacity: isActive ? 1 : 0.62,
              transition: "opacity 0.2s, transform 0.2s",
            }}
          />
        ) : (
          <img
            src={applyCloudinaryTransform(cat.icon, "f_auto,q_auto,w_100")}
            alt={cat.name}
            loading="lazy"
            className="h-5 w-5 object-contain md:h-6 md:w-6"
            style={{ opacity: isActive ? 1 : 0.62 }}
          />
        )}
      </div>
      <div className="relative mt-px w-full">
        <span
          className={cn(
            "relative z-10 mx-auto block max-w-[80px] truncate px-1 pb-0.5 text-center text-[10px] font-['Inter'] tracking-tight md:max-w-[96px] md:text-[12px]",
            isActive ? "font-black" : "font-semibold",
          )}
          style={{
            color: isActive ? iconColor : (headerFontColor || "#111111"),
            opacity: isActive ? 1 : 0.68,
            fontFamily: "'Inter', sans-serif",
          }}>
          {cat.name}
        </span>
      </div>
      {isActive && (
        <motion.div
          layoutId="active-category-line"
          className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-full"
          style={{ backgroundColor: categoryAccent }}
          transition={{
            type: "spring",
            stiffness: 380,
            damping: 30,
          }}
        />
      )}
    </motion.div>
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

  const contentHeight = "80px";
  const contentOpacity = 1;
  const navHeight = "60px";
  const navOpacity = 1;
  const navMargin = 4;
  const categorySpacing = 3;
  const cartOpacity = 1;
  const cartScale = 1;

  const displayContent = "block";
  const displayNav = "flex";
  const displayCart = "block";

  const baseHeaderColor = activeCategory?.headerColor || "#2E7D32";
  const headerFontColor = activeCategory?.headerFontColor || "#111827";
  const headerIconColor = activeCategory?.headerIconColor || "#111111";

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
            background: `linear-gradient(135deg, ${hexToRgba(baseHeaderColor, 0.95)} 0%, rgba(18, 18, 18, 0.95) 100%)`,
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          }}
          className="px-4 shadow-[0_8px_32px_rgba(0,0,0,0.25)] overflow-hidden transform-gpu will-change-transform">
          {/* Subtle Glow Overlay */}
          <div className="absolute inset-0 bg-white/8 pointer-events-none" />

          {/* Corner Lottie */}
          <motion.button
            initial={{ opacity: 0, scale: 0.9, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
            style={{
              opacity: cartOpacity,
              scale: cartScale,
              display: displayCart,
            }}
            type="button"
            aria-label="Open cart"
            onClick={() => navigate("/checkout")}
            className="absolute top-3 right-5 sm:top-4 sm:right-6 md:top-5 md:right-8 z-20 w-12 h-12 sm:w-14 sm:h-14 md:w-20 md:h-20 cursor-pointer">
            {cartAnimData ? (
              <Lottie
                animationData={cartAnimData}
                loop
                className="w-full h-full pointer-events-none drop-shadow-[0_8px_18px_rgba(0,0,0,0.14)]"
              />
            ) : (
              <div className="w-full h-full" />
            )}
          </motion.button>

          {/* Desktop/Tablet Header Layout (md and above) */}
          <div className="hidden md:flex items-center justify-between relative z-20 px-2 lg:px-6 mb-4 mt-1">
            {/* Left Section: Logo + Location row */}
            <div className="flex items-center gap-4 lg:gap-8">
              <div
                onClick={() => navigate("/")}
                className="flex items-center gap-3 cursor-pointer group shrink-0">
                <div className="group-hover:scale-110 transition-all duration-300 drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]">
                  <img
                    src={logoUrl}
                    alt={`${appName} Logo`}
                    loading="lazy"
                    className="h-10 w-auto object-contain"
                  />
                </div>
              </div>

              {/* Location Block (Desktop inline row) */}
              <div className="flex flex-col border-l border-white/10 pl-4 lg:pl-8 h-10 justify-center">
                <button
                  type="button"
                  data-lenis-prevent
                  data-lenis-prevent-touch
                  onClick={() => {
                    setIsLocationOpen(true);
                  }}
                  className="flex items-center gap-1 text-white hover:text-gray-200 cursor-pointer group active:scale-95 transition-all border-0 bg-transparent p-0 text-left">
                  <LocationOnIcon sx={{ fontSize: 14, color: "#FFFFFF" }} />
                  <div
                    className="text-[13px] font-bold leading-tight max-w-[250px] lg:max-w-[320px] truncate text-white"
                  >
                    {isFetchingLocation
                      ? "Detecting location..."
                      : currentLocation.name}
                  </div>
                  <ChevronDownIcon
                    sx={{ fontSize: 12, opacity: 0.8, color: "#FFFFFF" }}
                  />
                </button>
              </div>
            </div>

            {/* Center Section: Search Bar */}
            {!hideSearchBar && (
              <div className="flex-1 max-w-[450px] lg:max-w-2xl px-6">
                <motion.div
                  onClick={handleSearchClick}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  style={{ backgroundColor: "rgba(17, 24, 39, 0.45)" }}
                  className="rounded-full px-4 h-11 shadow-sm flex items-center border border-white/10 transition-all duration-200 focus-within:ring-2 focus-within:ring-[#2E7D32]/50 cursor-pointer">
                  <SearchIcon sx={{ color: "#E5E7EB", fontSize: 20 }} />
                  <input
                    type="text"
                    placeholder={searchPlaceholder || "Search Products..."}
                    readOnly
                    className="flex-1 bg-transparent border-none outline-none pl-2 text-white font-medium placeholder:text-gray-400 text-[15px] cursor-pointer"
                  />
                </motion.div>
              </div>
            )}

            {/* Right Section: Action Icons */}
            <div className="flex items-center gap-5 lg:gap-8 shrink-0">
              <motion.button
                whileHover={{ scale: 1.15, rotate: 5 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate("/wishlist")}
                className="transition-all text-white hover:text-[#2E7D32]"
              >
                <FavoriteBorderOutlinedIcon sx={{ fontSize: 24 }} />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.15, rotate: -5 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate("/checkout")}
                className="transition-all text-white hover:text-[#2E7D32] relative group"
              >
                <ShoppingCartOutlinedIcon sx={{ fontSize: 24 }} />
                <span className="absolute -top-1.5 -right-1.5 bg-[#2E7D32] text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-[#1F2937] shadow-sm transition-transform group-hover:-translate-y-0.5">
                  0
                </span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate("/profile")}
                className="lg:bg-white/10 p-1.5 lg:rounded-full hover:bg-white/20 transition-all text-white"
              >
                <AccountCircleOutlinedIcon sx={{ fontSize: 28 }} />
              </motion.button>
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
                onClick={() => navigate("/")}
                className="mb-4 flex items-center gap-2 cursor-pointer select-none"
              >
                <img
                  src={logoUrl}
                  alt={`${appName} Logo`}
                  loading="lazy"
                  className="h-9 w-auto object-contain"
                />
                <span
                  className="text-sm font-black uppercase tracking-wider text-white"
                >
                  {appName}
                </span>
              </div>
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <button
                    type="button"
                    data-lenis-prevent
                    data-lenis-prevent-touch
                    onClick={() => {
                      setIsLocationOpen(true);
                    }}
                    className="flex items-center gap-1 text-white hover:text-gray-200 cursor-pointer group active:scale-95 transition-transform border-0 bg-transparent p-0 text-left">
                    <LocationOnIcon sx={{ fontSize: 14, color: "#FFFFFF" }} />
                    <div
                      className="text-[10px] font-medium leading-tight max-w-[280px] truncate text-gray-200"
                    >
                      {isFetchingLocation
                        ? "Detecting location..."
                        : currentLocation.name}
                    </div>
                    <ChevronDownIcon
                      sx={{ fontSize: 12, opacity: 0.8, color: "#FFFFFF" }}
                    />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Search Bar (MOBILE ONLY) */}
          {!hideSearchBar && (
            <div className="relative z-10 mt-[1.5px] flex items-center gap-2 md:hidden">
              <motion.div
                onClick={handleSearchClick}
                whileTap={{ scale: 0.98 }}
                style={{ backgroundColor: "rgba(17, 24, 39, 0.45)" }}
                className="flex-1 rounded-[10px] px-3 h-10 shadow-sm flex items-center border border-white/10 transition-all duration-200 focus-within:ring-2 focus-within:ring-[#2E7D32]/50 cursor-pointer">
                <SearchIcon sx={{ color: "#E5E7EB", fontSize: 18 }} />
                <input
                  type="text"
                  placeholder={searchPlaceholder || "Search Products..."}
                  readOnly
                  className="flex-1 bg-transparent border-none outline-none pl-2 text-white font-medium placeholder:text-gray-400 text-[14px] cursor-pointer"
                />
              </motion.div>
            </div>
          )}

          {/* Categories Navigation - Smooth Collapse */}
          {categories.length > 0 && (
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
              className="relative flex items-end md:justify-center gap-0 overflow-x-auto no-scrollbar -mx-2 px-2 md:mx-0 md:px-0 z-10 snap-x pt-1 min-h-[68px] md:min-h-[76px] pb-0.5">
              {categories.slice(0, 10).map((cat) => {
                const isActive = activeCategory?.id === cat.id;
                return (
                  <CategoryNavColumn
                    key={cat.id}
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

