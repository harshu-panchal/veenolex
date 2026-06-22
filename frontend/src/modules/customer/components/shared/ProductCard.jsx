import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, Plus, Minus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWishlist } from "../../context/WishlistContext";
import { useCart } from "../../context/CartContext";
import { useToast } from "@shared/components/ui/Toast";
import { useCartAnimation } from "../../context/CartAnimationContext";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";

import { motion, AnimatePresence } from "framer-motion";
import { Clock } from "lucide-react";
import { customerApi } from "../../services/customerApi";

const ProductCard = React.memo(
  ({ product, badge, className, compact = false, neutralBg = false }) => {
    const { toggleWishlist: toggleWishlistGlobal, isInWishlist } =
      useWishlist();
    const { cart, addToCart, updateQuantity, removeFromCart } = useCart();
    const { showToast } = useToast();
    const { animateAddToCart, animateRemoveFromCart } = useCartAnimation();
    const navigate = useNavigate();
    const [showHeartPopup, setShowHeartPopup] = React.useState(false);
    const [reviews, setReviews] = React.useState([]);
    const [isHovered, setIsHovered] = React.useState(false);
    const [activeImageIdx, setActiveImageIdx] = React.useState(0);

    const images = React.useMemo(() => {
      return [
        product.image || product.mainImage,
        ...(Array.isArray(product.galleryImages) ? product.galleryImages : []),
        ...(Array.isArray(product.images) ? product.images : [])
      ].filter(Boolean);
    }, [product]);

    React.useEffect(() => {
      if (!isHovered || images.length <= 1) {
        setActiveImageIdx(0);
        return;
      }
      const interval = setInterval(() => {
        setActiveImageIdx((prev) => (prev + 1) % images.length);
      }, 1500);
      return () => clearInterval(interval);
    }, [isHovered, images]);

    const imageRef = React.useRef(null);

    const defaultVariant = React.useMemo(() => {
      const variants = Array.isArray(product?.variants) ? product.variants : [];
      if (variants.length === 0) return null;

      const displayed = Number(product?.price || 0);
      const displayedOriginal = Number(product?.originalPrice || 0);

      const matchesDisplayedPrice = (variant) => {
        const mrp = Number(variant?.price || 0);
        const sale = Number(variant?.salePrice || 0);
        const effective = sale > 0 && sale < mrp ? sale : mrp;

        if (Number.isFinite(displayedOriginal) && displayedOriginal > displayed) {
          // Try to match both (sale + original) when card shows a discount.
          if (effective === displayed && (mrp === displayedOriginal || displayedOriginal === 0)) {
            return true;
          }
        }

        return effective === displayed || mrp === displayed;
      };

      const picked = variants.find(matchesDisplayedPrice) || variants[0];
      const key = String(picked?.sku || picked?.name || "").trim();
      return {
        key,
        name: String(picked?.name || "").trim(),
      };
    }, [product]);

    const discountPercent = React.useMemo(() => {
      const original = Number(product?.originalPrice || 0);
      const current = Number(product?.price || 0);
      return original > current && current > 0
        ? Math.round(((original - current) / original) * 100)
        : 0;
    }, [product]);

    const displayBadgeText = React.useMemo(() => {
      if (badge) return badge;
      if (discountPercent > 0) {
        return `${discountPercent}% OFF`;
      }
      if (product?.discount) return product.discount;
      return null;
    }, [badge, product?.discount, discountPercent]);

    const productId = product.id || product._id;
    const variantKey = String(defaultVariant?.key || "").trim();
    const cartKey = `${productId}::${variantKey || ""}`;

    const cartItem = React.useMemo(
      () =>
        cart.find(
          (item) =>
            `${item.id || item._id}::${String(item.variantSku || "").trim()}` ===
            cartKey,
        ),
      [cart, cartKey],
    );
    const quantity = cartItem ? cartItem.quantity : 0;
    const isWishlisted = isInWishlist(product.id || product._id);

    const [hasFetchedReviews, setHasFetchedReviews] = React.useState(false);

    React.useEffect(() => {
      if (!isHovered || hasFetchedReviews || !productId) return;
      let isMounted = true;
      customerApi.getProductReviews(productId)
        .then((res) => {
          if (isMounted && res?.data?.success) {
            setReviews(res.data.results || res.data.result || []);
            setHasFetchedReviews(true);
          }
        })
        .catch(() => { });
      return () => { isMounted = false; };
    }, [productId, isHovered, hasFetchedReviews]);

    const { rating, reviewsCount } = React.useMemo(() => {
      if (!reviews || reviews.length === 0) {
        return {
          rating: "0.0",
          reviewsCount: 0,
        };
      }
      const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
      const avg = sum / reviews.length;
      return {
        rating: avg.toFixed(1),
        reviewsCount: reviews.length,
      };
    }, [reviews]);

    const variantLabel = React.useMemo(() => {
      const name = defaultVariant?.name;
      if (name && name.toLowerCase() !== "default") return name;
      return product.weight || "1 unit";
    }, [defaultVariant, product.weight]);

    const benefitText = React.useMemo(() => {
      if (product.description) {
        let clean = product.description;
        if (clean.startsWith("{\\rtf")) {
          // Strip RTF metadata groups
          clean = clean.replace(/\{\\fonttbl[^}]*\}/g, "");
          clean = clean.replace(/\{\\colortbl[^}]*\}/g, "");
          clean = clean.replace(/\{\\stylesheet[^}]*\}/g, "");
          clean = clean.replace(/\{\\info[^}]*\}/g, "");
          clean = clean.replace(/\{\\\*\\generator[^}]*\}/g, "");
          // Strip control words
          clean = clean.replace(/\\[a-z0-9\-]+/gi, " ");
          // Strip braces
          clean = clean.replace(/[{}]/g, "");
        } else {
          // Strip HTML tags
          clean = clean.replace(/<[^>]*>/g, "");
        }
        clean = clean.replace(/\s+/g, " ").trim();

        if (clean.length > 0) {
          const firstSentence = clean.split(/[.!?]/)[0];
          if (firstSentence.length > 5 && firstSentence.length < 60) return firstSentence;
          return clean.slice(0, 45) + (clean.length > 45 ? "..." : "");
        }
      }
      return "100% Pure & Natural | Quality Guarantees";
    }, [product]);

    const handleProductClick = React.useCallback(
      (e) => {
        e.preventDefault();
        navigate(`/product/${productId}`);
      },
      [navigate, productId],
    );

    const toggleWishlist = React.useCallback(
      (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isWishlisted) {
          setShowHeartPopup(true);
          setTimeout(() => setShowHeartPopup(false), 1000);
        }

        toggleWishlistGlobal(product);
        showToast(
          isWishlisted
            ? `${product.name} removed from wishlist`
            : `${product.name} added to wishlist`,
          isWishlisted ? "info" : "success",
        );
      },
      [isWishlisted, toggleWishlistGlobal, product, showToast],
    );

    const handleAddToCart = React.useCallback(
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (imageRef.current) {
          animateAddToCart(
            imageRef.current.getBoundingClientRect(),
            product.image,
          );
        }
        addToCart({
          ...product,
          variantSku: variantKey,
          variantName: defaultVariant?.name || "",
        });
      },
      [animateAddToCart, product, addToCart, variantKey, defaultVariant?.name],
    );

    const handleIncrement = React.useCallback(
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        updateQuantity(productId, 1, variantKey);
      },
      [updateQuantity, productId, variantKey],
    );

    const handleDecrement = React.useCallback(
      (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (quantity === 1) {
          animateRemoveFromCart(product.image);
          removeFromCart(productId, variantKey);
        } else {
          updateQuantity(productId, -1, variantKey);
        }
      },
      [
        quantity,
        animateRemoveFromCart,
        product.image,
        removeFromCart,
        productId,
        updateQuantity,
        variantKey,
      ],
    );

    return (
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "group flex-shrink-0 w-full rounded-xl sm:rounded-2xl overflow-hidden flex flex-col h-full shadow-sm cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1.5 hover:shadow-lg hover:shadow-black/5 font-['Inter']",
          compact
            ? "bg-white border-[1.5px] border-brand-50 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)]"
            : neutralBg
              ? "bg-white border border-slate-100 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)]"
              : "bg-primary/10 border border-primary/20",
          className,
        )}
        onClick={handleProductClick}>
        {/* Top Image Section */}
        <div className="relative">
          {/* Badge (Custom or Discount) */}
          {displayBadgeText && (
            <div
              className={cn(
                "absolute z-10 bg-[#ff2c38] text-white font-[900] rounded-md shadow-sm uppercase tracking-wider flex items-center justify-center",
                compact
                  ? "top-2 left-2 px-1.5 py-0.5 text-[7px]"
                  : "top-2 left-2 px-1.5 py-0.5 text-[7px] sm:top-3 sm:left-3 sm:px-2 sm:py-1 sm:text-[9px]",
              )}>
              {displayBadgeText}
            </div>
          )}

          <button
            onClick={toggleWishlist}
            className={cn(
              "absolute z-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center cursor-pointer hover:bg-white transition-all active:scale-90",
              compact
                ? "top-2 right-2 h-7 w-7"
                : "top-2 right-2 h-6.5 w-6.5 sm:top-3 sm:right-3 sm:h-8 sm:w-8",
            )}>
            <motion.div
              whileTap={{ scale: 0.8 }}
              animate={isWishlisted ? { scale: [1, 1.2, 1] } : {}}>
              <Heart
                size={compact ? 12 : 14}
                className={cn(
                  isWishlisted
                    ? "text-red-500 fill-current"
                    : "text-neutral-400",
                )}
              />
            </motion.div>
          </button>

          <AnimatePresence>
            {showHeartPopup && (
              <motion.div
                initial={{ scale: 0.5, opacity: 1, y: 0 }}
                animate={{ scale: 2, opacity: 0, y: -40 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="absolute top-3 right-3 z-50 pointer-events-none text-red-500">
                <Heart size={24} fill="currentColor" />
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className={cn(
              "block w-full overflow-hidden flex items-center justify-center transition-transform duration-500 group-hover:scale-105 aspect-square relative",
              compact || neutralBg ? "bg-white/70" : "bg-white/50"
            )}>
            <AnimatePresence initial={false} mode="wait">
              <motion.img
                key={activeImageIdx}
                ref={activeImageIdx === 0 ? imageRef : null}
                src={applyCloudinaryTransform(images[activeImageIdx])}
                alt={product.name}
                initial={{ x: 30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -30, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                loading="lazy"
                className="w-full h-full object-cover mix-blend-multiply absolute inset-0"
              />
            </AnimatePresence>

            {/* Sliding dot indicators to show multiple images are sliding */}
            {images.length > 1 && isHovered && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10 bg-black/20 px-2 py-0.5 rounded-full backdrop-blur-sm transition-all duration-300">
                {images.map((_, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "w-1 h-1 rounded-full transition-all duration-300",
                      idx === activeImageIdx ? "bg-white scale-125" : "bg-white/50"
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info Section */}
        {/* Mobile Info Section (hidden on desktop) */}
        <div
          className={cn(
            "md:hidden flex flex-col flex-1 gap-0.5",
            compact
              ? "p-3 pt-2.5 sm:p-3.5 sm:pt-3.5"
              : "bg-white/40 p-3.5 pt-4 sm:p-5 sm:pt-5",
          )}>
          <div className="flex items-center gap-1 mb-0.5 sm:gap-1.5 sm:mb-1">
            <div
              className={cn(
                "border-2 border-primary rounded-full flex items-center justify-center",
                compact ? "h-2.5 w-2.5" : "h-2.5 w-2.5 sm:h-3.5 sm:w-3.5",
              )}>
              <div
                className={cn(
                  "bg-primary rounded-full",
                  compact ? "h-0.5 w-0.5" : "h-1 w-1",
                )}
              />
            </div>
            <div
              className={cn(
                "bg-brand-50 text-brand-600 font-bold rounded px-1.5 py-0 tracking-wide text-[8px] sm:text-[9px]",
              )}>
              {variantLabel}
            </div>
          </div>

          <div className={cn(compact ? "h-8" : "h-8 sm:h-9")}>
            <h4
              className={cn(
                "font-[600] text-[#1A1A1A] leading-tight line-clamp-2",
                compact ? "text-[10.5px]" : "text-[12px] sm:text-[13px]",
              )}>
              {product.name}
            </h4>
          </div>

          {/* Price Section */}
          <div className="mt-auto flex items-baseline gap-1.5">
            <span
              className={cn(
                "font-[1000] text-[#1A1A1A] leading-none",
                compact ? "text-[12px] sm:text-[13px]" : "text-[14px] sm:text-base",
              )}>
              ₹{product.price}
            </span>
            {product.originalPrice > product.price && (
              <span
                className={cn(
                  "font-medium text-gray-400 line-through leading-none",
                  compact ? "text-[9px] sm:text-[10px]" : "text-[10px] sm:text-[12px]",
                )}>
                ₹{product.originalPrice}
              </span>
            )}
          </div>

          {/* ADD Button / Quantity Selector */}
          <div className="mt-2 w-full flex">
            {quantity > 0 ? (
              <div
                style={{
                  backgroundColor: "#0f9ed5",
                }}
                className={cn(
                  "flex items-center rounded-lg p-0.5 justify-between w-full text-white shadow-md",
                  compact ? "h-7 sm:h-8" : "h-8 sm:h-9"
                )}>
                <button
                  onClick={handleDecrement}
                  className="p-1 px-2.5 text-white active:scale-90 transition-transform">
                  <Minus size={compact ? 10 : 12} strokeWidth={3.5} />
                </button>
                <span
                  className="font-black text-white text-[11px] sm:text-xs">
                  {quantity}
                </span>
                <button
                  onClick={handleIncrement}
                  className="p-1 px-2.5 text-white active:scale-90 transition-transform">
                  <Plus size={compact ? 10 : 12} strokeWidth={3.5} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleAddToCart}
                style={{
                  backgroundColor: "#0f9ed5",
                }}
                className={cn(
                  "w-full text-white rounded-lg font-black shadow-md hover:shadow-lg hover:brightness-105 flex items-center justify-center transition-all uppercase tracking-wide active:scale-95",
                  compact ? "h-7 sm:h-8 text-[10px] sm:text-xs" : "h-8 sm:h-9 text-xs sm:text-sm"
                )}>
                ADD
              </button>
            )}
          </div>
        </div>

        {/* Desktop Info Section (hidden on mobile) */}
        <div className="hidden md:flex flex-col flex-1 p-5 gap-2.5 items-center text-center bg-white">
          {/* Title */}
          <div className="h-12 flex items-center justify-center">
            <h4 className="font-semibold text-slate-800 text-[15px] leading-tight line-clamp-2">
              {product.name}
            </h4>
          </div>

          {/* Tagline/Benefit */}
          <p className="text-[12px] font-medium text-green-600 leading-tight">
            {benefitText}
          </p>

          {/* Weight */}
          <p className="text-[12px] font-semibold text-slate-500">
            {variantLabel}
          </p>

          {/* Ratings & Reviews */}
          <div className="flex items-center gap-1.5 justify-center text-[11px] font-semibold text-slate-500 min-h-[16px]">
            {reviewsCount > 0 ? (
              <>
                <span className="flex items-center gap-0.5 text-amber-500">
                  <Star size={12} className="fill-current" />
                  {rating}
                </span>
                <span className="h-2.5 w-[1px] bg-slate-200" />
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-blue-500 fill-current" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {reviewsCount} {reviewsCount === 1 ? "Review" : "Reviews"}
                </span>
              </>
            ) : (
              <span className="text-slate-400 italic">No reviews yet</span>
            )}
          </div>

          {/* Price Section */}
          <div className="mt-auto flex items-center gap-2 justify-center">
            <span className="font-extrabold text-slate-800 text-base">
              ₹{product.price}
            </span>
            {product.originalPrice > product.price && (
              <>
                <span className="font-medium text-slate-400 line-through text-[12px]">
                  ₹{product.originalPrice}
                </span>
                <span className="bg-brand-50 text-brand-700 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                  {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF
                </span>
              </>
            )}
          </div>

          {/* ADD TO CART Button / Quantity Selector */}
          <div className="mt-3 w-full flex">
            {quantity > 0 ? (
              <div
                style={{
                  backgroundColor: "#0f9ed5",
                }}
                className="flex items-center rounded-lg p-0.5 justify-between w-full h-10 text-white shadow-md">
                <button
                  onClick={handleDecrement}
                  className="p-1 px-3 text-white active:scale-90 transition-transform">
                  <Minus size={12} strokeWidth={3.5} />
                </button>
                <span className="font-black text-white text-[13px]">
                  {quantity} in Cart
                </span>
                <button
                  onClick={handleIncrement}
                  className="p-1 px-3 text-white active:scale-90 transition-transform">
                  <Plus size={12} strokeWidth={3.5} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleAddToCart}
                style={{
                  backgroundColor: "#0f9ed5",
                }}
                className="w-full h-10 text-white rounded-lg font-black shadow-md hover:shadow-lg hover:brightness-105 flex items-center justify-center transition-all uppercase tracking-wider text-[12px] active:scale-95">
                ADD TO CART
              </button>
            )}
          </div>
        </div>
      </div>
    );
  },
);

export default ProductCard;
