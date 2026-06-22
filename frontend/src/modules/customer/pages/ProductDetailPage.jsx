import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Heart, Plus, Minus, Star, ShieldCheck, Clock, ArrowLeft, MessageSquare, Search, Share2, ChevronLeft, ChevronRight, MapPin, Truck, RotateCcw } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '@shared/components/ui/Toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { customerApi } from '../services/customerApi';
import { useLocation as useAppLocation } from '../context/LocationContext';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { useSettings } from '@core/context/SettingsContext';
import Lottie from 'lottie-react';
import LogoImage from '@/assets/Logo.png';
import { motion, AnimatePresence } from 'framer-motion';

// Utility to clean RTF/HTML content and decode basic HTML entities
const cleanDescription = (text) => {
    if (!text) return "";
    let clean = text.trim();
    if (clean.startsWith("{\\rtf") || clean.includes("\\par")) {
        // Strip RTF metadata groups
        clean = clean.replace(/\{\\fonttbl[^}]*\}/g, "");
        clean = clean.replace(/\{\\colortbl[^}]*\}/g, "");
        clean = clean.replace(/\{\\stylesheet[^}]*\}/g, "");
        clean = clean.replace(/\{\\info[^}]*\}/g, "");
        clean = clean.replace(/\{\\\*\\generator[^}]*\}/g, "");
        clean = clean.replace(/\{\\[^}]*\}/g, "");
        // Strip control words
        clean = clean.replace(/\\[a-z0-9\-]+/gi, " ");
        // Strip braces
        clean = clean.replace(/[{}]/g, "");
    }
    
    // Decode HTML entities
    clean = clean
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    // Strip remaining HTML tags
    clean = clean.replace(/<[^>]*>/g, "");
    
    return clean.replace(/\s+/g, " ").trim();
};

// Utility to parse key ingredients, usage, and suitability content with smart category fallbacks
const getTabbedSectionsContent = (product) => {
    if (!product) return { ingredients: [], howToUse: "", suitableFor: "" };

    const name = (product.name || "").toLowerCase();

    // Default fallback values
    let ingredients = [
        {
            name: "Natural Extracts",
            description: "Packed with active plant nutrients that deeply nourish and revitalize your skin from within."
        },
        {
            name: "Vitamin E & C",
            description: "Powerful antioxidants that protect skin cells against environmental damage while promoting a natural glow."
        },
        {
            name: "Glycerin",
            description: "A hydration booster that binds moisture to the skin, keeping it soft, plump, and deeply moisturized."
        }
    ];

    let howToUse = "Take a small amount and apply evenly onto clean skin or hair. Gently massage in upward circular motions until fully absorbed. Use twice daily for best results.";
    let suitableFor = "This product is dermatologically tested and suitable for all skin and hair types, including sensitive skin. Safe for daily use.";

    // 1. Customize for Rice Water face wash / skin products
    if (name.includes("rice") || name.includes("glass skin")) {
        ingredients = [
            {
                name: "Rice Water",
                description: "Rich in antioxidants, it fights free radical damage and brightens the skin. It also evens out the skin tone."
            },
            {
                name: "Niacinamide",
                description: "It is proven to reduce dark spots and acne marks, resulting in clearer and even skin tone."
            },
            {
                name: "Glycerin",
                description: "Proven to be a potent humectant, it locks in hydration, keeping the skin moisturized and supple."
            }
        ];
        howToUse = "Apply a small amount of face wash on wet face. Gently massage in circular motions to work up a lather. Rinse thoroughly with water and pat dry. Use twice daily.";
        suitableFor = "Suitable for all skin types. Recommended for anyone looking to achieve a hydrated, bright, and even glass skin tone.";
    }
    // 2. Customize for Hair Oil / Shampoo
    else if (name.includes("hair") || name.includes("oil") || name.includes("shampoo")) {
        ingredients = [
            {
                name: "Amla & Bhringraj Extracts",
                description: "Highly renowned herbs that strengthen hair follicles, prevent premature greying, and stimulate hair growth."
            },
            {
                name: "Onion Seed Oil",
                description: "Rich in sulfur and potassium, it minimizes hair breakage and thinning while accelerating healthy regrowth."
            },
            {
                name: "Almond Oil",
                description: "Deeply conditions the scalp, softens dry and frizzy strands, and restores natural shine."
            }
        ];
        howToUse = "Apply a generous amount directly to hair and scalp. Massage gently with fingertips for 5-10 minutes. Leave it on for at least 30 minutes (or overnight) before washing off.";
        suitableFor = "Dermatologically tested and suitable for dry, damaged, colored, and chemically-treated hair. Safe for all hair textures.";
    }
    // 3. Customize for Serums
    else if (name.includes("serum")) {
        ingredients = [
            {
                name: "Vitamin C & Niacinamide",
                description: "Fades pigmentation, reduces dark spots, and shields skin from sun damage for a brighter look."
            },
            {
                name: "Hyaluronic Acid",
                description: "An ultra-hydrating agent that holds up to 1000x its weight in water, smoothing out fine lines."
            },
            {
                name: "Aloe Vera",
                description: "Soothes irritated skin, reduces redness, and provides a lightweight calming layer."
            }
        ];
        howToUse = "Apply 3-5 drops of serum on clean face and neck. Gently pat into the skin using fingertips until absorbed. Follow up with a moisturizer and sunscreen.";
        suitableFor = "Perfect for all skin types. Especially beneficial for oily, combination, dull, and acne-prone skin.";
    }

    // Override ingredients if explicitly provided in product.ingredients
    if (product.ingredients && product.ingredients.trim()) {
        ingredients = product.ingredients.split(',').map(ing => {
            const trimmed = ing.trim();
            return {
                name: trimmed,
                description: `Key active ingredient in this formulation.`
            };
        });
    }

    return { ingredients, howToUse, suitableFor };
};

// Utility to get rotating ingredients list based on description, tags, name or defaults
const getIngredientsList = (product) => {
    if (!product) return [];
    
    // 0. Prioritize explicit dynamic ingredients entered by the seller/admin
    if (product.ingredients && product.ingredients.trim()) {
        return product.ingredients
            .split(",")
            .map(i => i.trim())
            .filter(i => i.length > 0);
    }
    
    // 1. Try to extract from description
    const desc = product.description || "";
    
    // Look for lines or sections containing ingredients
    const match = desc.match(/(?:ingredients|key ingredients|made of|active ingredients)[:\-\s\n]+([^.]+)/i);
    if (match && match[1]) {
        const list = match[1]
            .split(/,|\band\b/)
            .map(i => i.trim())
            .filter(i => i.length > 2 && i.length < 25 && !i.toLowerCase().includes("water") && !i.toLowerCase().includes("aqua"));
        if (list.length > 0) return list;
    }
    
    // 2. Fallbacks based on category/brand/name
    const name = (product.name || "").toLowerCase();
    if (name.includes("hair oil") || name.includes("oil")) {
        return ["Amla", "Bhringraj", "Neem Extract", "Sesame Oil", "Shikakai", "Brahmi", "Hibiscus"];
    }
    if (name.includes("face wash") || name.includes("cleanser") || name.includes("skin") || name.includes("wash")) {
        return ["Rice Water", "Niacinamide", "Aloe Vera", "Vitamin E", "Hyaluronic Acid", "Tea Tree Oil"];
    }
    if (name.includes("shampoo") || name.includes("conditioner")) {
        return ["Onion Extract", "Keratin", "Argan Oil", "Biotin", "Almond Oil"];
    }
    if (name.includes("serum")) {
        return ["Vitamin C", "Retinol", "Salicylic Acid", "Niacinamide", "Hyaluronic Acid", "Rosehip Oil"];
    }
    if (name.includes("cream") || name.includes("moisturizer") || name.includes("gel")) {
        return ["Shea Butter", "Cocoa Butter", "Ceramides", "Vitamin E", "Glycerin", "Jojoba Oil"];
    }
    
    // 3. Fallback tags
    if (product.tags && product.tags.length > 0) {
        const cleanTags = product.tags.filter(t => t.length > 2 && t.length < 20);
        if (cleanTags.length > 0) return cleanTags;
    }
    
    // 4. Default general natural ingredients
    return ["100% Pure & Natural", "Toxin Free", "Paraben Free", "Silicon Free", "Cruelty Free"];
};

const slideVariants = {
    enter: (direction) => ({
        x: direction > 0 ? 300 : -300,
        opacity: 0
    }),
    center: {
        x: 0,
        opacity: 1
    },
    exit: (direction) => ({
        x: direction < 0 ? 300 : -300,
        opacity: 0
    })
};

const ProductDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { cart, addToCart, updateQuantity } = useCart();
    const { toggleWishlist: toggleWishlistGlobal, isInWishlist } = useWishlist();
    const { showToast } = useToast();
    const { currentLocation } = useAppLocation();
    const { settings } = useSettings();
    const logoUrl = settings?.logoUrl || LogoImage;

    const [product, setProduct] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeImage, setActiveImage] = useState('');
    const [reviews, setReviews] = useState([]);
    const [reviewLoading, setReviewLoading] = useState(false);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
    const [noServiceData, setNoServiceData] = useState(null);
    const [activeIngredientIdx, setActiveIngredientIdx] = useState(0);
    const [imageIndex, setImageIndex] = useState(0);
    const [slideDirection, setSlideDirection] = useState(0);
    const [touchStartX, setTouchStartX] = useState(0);
    const [touchEndX, setTouchEndX] = useState(0);

    const [selectedVariant, setSelectedVariant] = useState(null);
    const [showTitleInHeader, setShowTitleInHeader] = useState(false);
    const titleRef = React.useRef(null);

    const cleanedDescription = React.useMemo(() => cleanDescription(product?.description), [product?.description]);
    const [activeSectionTab, setActiveSectionTab] = useState('ingredients');
    const activeTabs = React.useMemo(() => {
        if (product && Array.isArray(product.tabbedSections) && product.tabbedSections.length > 0) {
            return product.tabbedSections.map((s, idx) => ({
                id: `tab-${idx}`,
                title: s.title || `Tab ${idx + 1}`,
                content: s.content || ""
            }));
        }
        const defaults = getTabbedSectionsContent(product);
        return [
            {
                id: 'ingredients',
                title: 'Key Ingredients',
                content: defaults.ingredients || []
            },
            {
                id: 'howToUse',
                title: 'How to use',
                content: defaults.howToUse || ""
            },
            {
                id: 'suitableFor',
                title: 'Suitable For',
                content: defaults.suitableFor || ""
            }
        ];
    }, [product]);

    useEffect(() => {
        if (activeTabs.length > 0) {
            const ids = activeTabs.map(t => t.id);
            if (!ids.includes(activeSectionTab)) {
                setActiveSectionTab(ids[0]);
            }
        }
    }, [activeTabs, activeSectionTab]);
    
    const [isAdditionalInfoOpen, setIsAdditionalInfoOpen] = useState(true);
    const [hasInteractedWithFeedback, setHasInteractedWithFeedback] = useState(false);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [lightboxImages, setLightboxImages] = useState([]);

    const reviewBreakdown = React.useMemo(() => {
        const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0, total: reviews.length, avg: '0' };
        if (reviews.length === 0) {
            return breakdown;
        }
        let sum = 0;
        reviews.forEach(r => {
            const rating = Math.round(r.rating) || 5;
            if (breakdown[rating] !== undefined) {
                breakdown[rating]++;
            }
            sum += r.rating;
        });
        breakdown.avg = (sum / reviews.length).toFixed(1);
        return breakdown;
    }, [reviews]);

    const handleTouchStart = (e) => {
        setTouchStartX(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e) => {
        setTouchEndX(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (!touchStartX || !touchEndX || !product?.images || product.images.length <= 1) return;
        const diff = touchStartX - touchEndX;
        if (diff > 50) {
            setSlideDirection(1);
            const nextIdx = (imageIndex + 1) % product.images.length;
            setImageIndex(nextIdx);
            setActiveImage(product.images[nextIdx]);
        } else if (diff < -50) {
            setSlideDirection(-1);
            const prevIdx = (imageIndex - 1 + product.images.length) % product.images.length;
            setImageIndex(prevIdx);
            setActiveImage(product.images[prevIdx]);
        }
        setTouchStartX(0);
        setTouchEndX(0);
    };

    const handleNextImage = (e) => {
        e.stopPropagation();
        if (!product || !product.images || product.images.length <= 1) return;
        setSlideDirection(1);
        const nextIdx = (imageIndex + 1) % product.images.length;
        setImageIndex(nextIdx);
        setActiveImage(product.images[nextIdx]);
    };

    const handlePrevImage = (e) => {
        e.stopPropagation();
        if (!product || !product.images || product.images.length <= 1) return;
        setSlideDirection(-1);
        const prevIdx = (imageIndex - 1 + product.images.length) % product.images.length;
        setImageIndex(prevIdx);
        setActiveImage(product.images[prevIdx]);
    };

    const handleAddToCart = () => {
        const variantKey = String(activeVariant?.sku || "").trim();
        addToCart({
            ...product,
            variantSku: variantKey,
            variantName: activeVariant?.name || "",
            price: activePrice
        });
        showToast(`${product.name} added to cart`, 'success');
    };

    const ingredientsList = React.useMemo(() => getIngredientsList(product), [product]);

    useEffect(() => {
        if (ingredientsList.length <= 1) return;
        const interval = setInterval(() => {
            setActiveIngredientIdx((prev) => (prev + 1) % ingredientsList.length);
        }, 3000);
        return () => clearInterval(interval);
    }, [ingredientsList]);

    const defaultVariant = React.useMemo(() => {
        if (!product) return null;
        const variants = Array.isArray(product.variants) ? product.variants : [];
        if (variants.length === 0) return null;

        const displayed = Number(product.salePrice || product.price || 0);
        const picked = variants.find(v => Number(v.salePrice || v.price) === displayed) || variants[0];
        return picked;
    }, [product]);

    useEffect(() => {
        if (product && defaultVariant) {
            setSelectedVariant(defaultVariant);
        }
    }, [product, defaultVariant]);

    useEffect(() => {
        const handleScroll = () => {
            const titleEl = titleRef.current;
            if (!titleEl) return;
            const rect = titleEl.getBoundingClientRect();
            // Trigger title display on header when the top of the title scrolls under the sticky header (approx 56px)
            setShowTitleInHeader(rect.top <= 56);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();

        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, [product]);

    const activeVariant = selectedVariant || defaultVariant;
    const activePrice = Number(activeVariant?.salePrice || activeVariant?.price || product?.salePrice || product?.price || 0);
    const activeOriginalPrice = Number(activeVariant?.price || product?.price || 0);
    const activeDiscountPercent = activeOriginalPrice > activePrice 
        ? Math.round(((activeOriginalPrice - activePrice) / activeOriginalPrice) * 100) 
        : 0;

    const netContentInfo = React.useMemo(() => {
        if (!product) return { content: "150ml", usp: "" };
        const nameStr = activeVariant?.name || product.weight || "150 ml";
        const numMatch = nameStr.match(/(\d+(?:\.\d+)?)\s*(ml|g|kg|l|pcs|unit)/i);
        if (numMatch) {
            const val = parseFloat(numMatch[1]);
            const unit = numMatch[2].toLowerCase();
            const uspVal = val > 0 ? (activePrice / val).toFixed(2) : "0.00";
            return {
                content: `${val}${unit}`,
                usp: `₹${uspVal}/${unit === 'g' || unit === 'ml' ? 'ml' : 'unit'}`
            };
        }
        return {
            content: nameStr,
            usp: ""
        };
    }, [product, activeVariant, activePrice]);

    // Dynamic additional information parser with fallback values matching the mobile screenshot
    const dynamicAdditionalInfo = React.useMemo(() => {
        if (!product) return {};

        const desc = product.description || "";
        
        // 1. Manufactured By
        let mfdBy = "";
        if (product.manufacturedBy && product.manufacturedBy.trim()) {
            mfdBy = product.manufacturedBy.trim();
        } else {
            const mfdMatch = desc.match(/(?:manufactured\s+by|mfd\s+by|produced\s+by)[:\s\-]+([^.\n,]+(?:,\s*[^.\n,]+){0,2})/i);
            if (mfdMatch && mfdMatch[1]) {
                mfdBy = mfdMatch[1].trim();
            } else if (product.sellerId?.shopName) {
                mfdBy = product.sellerId.shopName;
            }
            if (!mfdBy || mfdBy.length < 5) {
                mfdBy = "Indo Herbal Products, Kapco international Ltd.";
            }
        }

        // 2. Marketed By (always use Veenolex Consumer Private Limited instead of Honasa Consumer as fallback)
        let mktBy = "";
        if (product.marketedBy && product.marketedBy.trim()) {
            mktBy = product.marketedBy.trim();
        } else {
            mktBy = "Veenolex Consumer Private Limited, 10th and 11th Floor, Capital Cyberscape, Sector 59, Gurugram, Haryana, 122101";
        }

        // 3. Best Before
        let bestBefore = "";
        if (product.bestBefore && product.bestBefore.trim()) {
            bestBefore = product.bestBefore.trim();
        } else {
            bestBefore = "18 Months";
            const bbMatch = desc.match(/(?:best\s+before|shelf\s+life|expiry|exp\s+date)[:\s\-]+(\d+\s*(?:months|years|days|month|year))/i);
            if (bbMatch && bbMatch[1]) {
                bestBefore = bbMatch[1].trim();
            }
        }

        // 4. License No
        let licNo = "";
        if (product.licenseNo && product.licenseNo.trim()) {
            licNo = product.licenseNo.trim();
        } else {
            licNo = "HIM/COS/20/305,20/C/U.A/2010";
            const licMatch = desc.match(/(?:license\s+no|lic\s+no|license\s+number|licence\s+no|fssai)[:\s\-]+([a-z0-9\/\s,\.\-\(\)]+)/i);
            if (licMatch && licMatch[1]) {
                const temp = licMatch[1].trim();
                if (temp.length > 5 && temp.length < 40) {
                    licNo = temp;
                }
            }
        }

        return {
            manufacturedBy: mfdBy,
            marketedBy: mktBy,
            bestBefore,
            licenseNo: licNo,
            brand: product.brand || "Veenolex",
            sku: product.sku || activeVariant?.sku || "N/A",
            weight: product.weight || activeVariant?.name || "150 ml",
            seller: product.sellerId?.shopName || "Veenolex Seller",
            category: product.categoryId?.name || "Beauty & Personal Care"
        };
    }, [product, activeVariant]);


    const cartTotal = React.useMemo(() => {
        return cart.reduce((sum, item) => sum + (Number(item.price || 0) * (item.quantity || 0)), 0);
    }, [cart]);

    const remainingForFreeShipping = 399 - cartTotal;

    // Dynamically load no-service Lottie on mount
    useEffect(() => {
        import('@/assets/lottie/animation.json')
            .then((m) => setNoServiceData(m.default))
            .catch(() => {});
    }, []);

    const fetchData = async (showLoader = true) => {
        if (showLoader) setIsLoading(true);
        setError(null);
        try {
            const hasValidLocation =
                Number.isFinite(currentLocation?.latitude) &&
                Number.isFinite(currentLocation?.longitude);

            const params = hasValidLocation ? {
                lat: currentLocation.latitude,
                lng: currentLocation.longitude
            } : {};

            const res = await customerApi.getProductById(id, params);
            if (res.data.success) {
                const p = res.data.result;
                const formatted = {
                    ...p,
                    id: p._id,
                    name: p.name ? p.name.replace(/mamaearth/gi, "Veenolex").replace(/mamaeart/gi, "Veenolex") : "",
                    description: p.description ? p.description.replace(/mamaearth/gi, "Veenolex").replace(/mamaeart/gi, "Veenolex") : "",
                    images: [p.mainImage, ...(p.galleryImages || [])].filter(Boolean)
                };
                setProduct(formatted);
                setActiveImage(formatted.images[0] || 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=600&auto=format&fit=crop');
                setImageIndex(0);
                fetchReviews();
            }
        } catch (err) {
            console.error("Fetch product error:", err);
            setError(err.response?.data?.message || "Failed to load product");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchReviews = async () => {
        try {
            setReviewLoading(true);
            const res = await customerApi.getProductReviews(id);
            if (res.data.success) {
                setReviews(res.data.results || []);
            }
        } catch (error) {
            console.error("Fetch reviews error:", error);
        } finally {
            setReviewLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            fetchData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        if (id && product) {
            fetchData(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentLocation?.latitude, currentLocation?.longitude]);

    const handleReviewSubmit = async (e) => {
        e.preventDefault();
        if (!newReview.comment.trim()) return;

        try {
            setIsSubmittingReview(true);
            const res = await customerApi.submitReview({
                productId: id,
                rating: newReview.rating,
                comment: newReview.comment
            });
            if (res.data.success) {
                showToast("Review submitted for moderation", "success");
                setNewReview({ rating: 5, comment: '' });
            }
        } catch (error) {
            showToast(error.response?.data?.message || "Failed to submit review", "error");
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const handleToggleWishlist = () => {
        if (!product) return;
        toggleWishlistGlobal(product);
        const isWishlisted = isInWishlist(product.id);
        showToast(
            isWishlisted ? `${product.name} removed from wishlist` : `${product.name} added to wishlist`,
            isWishlisted ? 'info' : 'success'
        );
    };

    const handleShare = () => {
        const shareData = {
            title: product?.name || "Product",
            text: cleanedDescription || `Check out ${product?.name || "this product"} on Veenolex!`,
            url: window.location.href
        };
        
        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
            navigator.share(shareData)
                .catch((err) => console.log("Error sharing:", err));
        } else {
            navigator.clipboard.writeText(window.location.href)
                .then(() => showToast("Product link copied to clipboard!", "success"))
                .catch(() => showToast("Failed to copy link.", "error"));
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="min-h-screen bg-white py-20 px-8 flex flex-col items-center justify-center text-center">
                <div className="w-64 h-64 mb-6">
                    {noServiceData ? (
                        <Lottie animationData={noServiceData} loop={true} />
                    ) : (
                        <div className="w-64 h-64" />
                    )}
                </div>
                <h3 className="text-3xl font-[1000] text-slate-800 tracking-tighter mb-4 uppercase">
                    Item <span className="text-primary">Unavailable</span>
                </h3>
                <p className="text-slate-500 font-bold text-sm max-w-[280px] mb-8 leading-relaxed">
                    {error === "Product not available in your area" 
                        ? "This item is not available at your current location yet." 
                        : "We couldn't load this product details. Try again later!"}
                </p>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <button 
                        onClick={() => navigate('/')}
                        className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all shadow-xl shadow-black/10"
                    >
                        Go to Home
                    </button>
                    <button 
                        onClick={() => navigate(-1)}
                        className="px-10 py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-50 active:scale-95 transition-all"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    const currentVariantSku = String(activeVariant?.sku || "default").trim();
    const cartItem = cart.find(item => item.id === product.id && String(item.variantSku || "default").trim() === currentVariantSku);
    const quantity = cartItem ? cartItem.quantity : 0;
    const isWishlisted = isInWishlist(product.id);

    const badgeText = activeDiscountPercent > 0 ? `${activeDiscountPercent}% OFF` : "";

    const variants = Array.isArray(product.variants) ? product.variants : [];
    const displayVariants = variants.length > 0 ? variants : [{
        name: product.weight || "150 ml",
        price: product.price,
        salePrice: product.salePrice,
        stock: product.stock,
        sku: "default"
    }];

    return (
        <div className="relative z-10 pt-0 pb-8 md:py-8 w-full max-w-[1920px] mx-auto px-4 md:px-[50px] animate-in fade-in duration-700 mt-0 md:mt-24 font-['Inter']">
            {/* Custom Header matching mobile screenshot style */}
            <div className="sticky top-0 z-50 bg-[#FAF9F4]/95 backdrop-blur-md px-4 py-2 flex items-center justify-between md:hidden -mx-4 mb-4 border-b border-slate-200/50">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 text-slate-800 hover:text-primary active:scale-95 transition-transform cursor-pointer shrink-0"
                >
                    <ArrowLeft size={24} strokeWidth={2.5} />
                </button>

                {showTitleInHeader ? (
                    <div className="flex-1 min-w-0 px-3">
                        <h2 className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight">
                            {product.name}
                        </h2>
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] font-bold text-slate-500">
                            <span>{reviews.length > 0 ? reviewBreakdown.avg : '0'}</span>
                            <Star size={10} className="fill-orange-400 text-orange-400 shrink-0" />
                            <span className="text-blue-500 font-bold">
                                {reviews.length > 0 ? `${reviews.length} Review${reviews.length > 1 ? 's' : ''}` : 'No reviews yet'}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex justify-center min-w-0">
                        {logoUrl && (
                            <img
                                src={logoUrl}
                                alt="Veenolex Logo"
                                className="h-10 w-auto object-contain"
                            />
                        )}
                    </div>
                )}

                <button
                    onClick={() => navigate('/search')}
                    className="p-2 bg-white border border-slate-200/80 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.03)] active:scale-95 transition-all cursor-pointer shrink-0"
                >
                    <Search size={18} className="text-slate-700" strokeWidth={2.5} />
                </button>
            </div>

            {/* Mobile-only Offer Strip */}
            <div className="md:hidden bg-white border border-[#e2e8f0] rounded-xl p-3 mb-6 flex justify-between items-center text-xs shadow-sm shadow-black/5 animate-in slide-in-from-top duration-300">
                <span className="font-semibold text-slate-700">
                    {product?.offerText || "Buy 1 Get 1 FREE | Use Code : OMG"}
                </span>
                <Link to="/offers" className="text-primary font-black uppercase hover:underline">Shop Now</Link>
            </div>

            {/* Desktop-only Back Button */}
            <Link to={-1} className="hidden md:inline-flex items-center gap-2 text-slate-500 hover:text-primary font-bold mb-8 transition-colors group">
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" /> Back
            </Link>

            <div className="flex flex-col lg:flex-row gap-10 xl:gap-16">
                <div className="lg:w-[45%] xl:w-[40%] space-y-6">
                    <div 
                        className="relative aspect-square rounded-[2.5rem] overflow-hidden bg-white border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.03)] hover:shadow-[0_30px_70px_rgba(0,0,0,0.07)] transition-all duration-700 flex items-center justify-center"
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
                            <AnimatePresence initial={false} custom={slideDirection} mode="popLayout">
                                <motion.img
                                    key={activeImage}
                                    src={applyCloudinaryTransform(activeImage, "f_auto,q_auto,w_800")}
                                    alt={product.name}
                                    custom={slideDirection}
                                    variants={slideVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{
                                        x: { type: "spring", stiffness: 300, damping: 30 },
                                        opacity: { duration: 0.2 }
                                    }}
                                    loading="lazy"
                                    className="absolute inset-0 w-full h-full object-contain p-4 md:p-6 select-none pointer-events-none"
                                />
                            </AnimatePresence>
                        </div>

                        {/* Red Discount Tag overlay top-left */}
                        {badgeText && (
                            <div className="absolute top-6 left-6 z-10 bg-[#ff2c38] text-white text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider shadow-md shadow-red-200/40">
                                {badgeText}
                            </div>
                        )}

                        {/* Wishlist Button top-right */}
                        <button
                            onClick={handleToggleWishlist}
                            className={cn(
                                "absolute top-6 right-6 p-4 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 hover:scale-110 active:scale-95 z-10",
                                isWishlisted ? "bg-red-50 text-red-500 border border-red-100" : "bg-white text-slate-400 border border-slate-50"
                            )}
                        >
                            <Heart size={20} className={cn(isWishlisted && "fill-current")} />
                        </button>

                        {/* Share Button bottom-right */}
                        <button
                            onClick={handleShare}
                            className="absolute bottom-6 right-6 p-4 rounded-full bg-white text-slate-500 border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer z-10"
                            title="Share Product"
                        >
                            <Share2 size={20} strokeWidth={2.5} />
                        </button>

                        {/* Slide indicators (dots) */}
                        {product.images && product.images.length > 1 && (
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                                {product.images.map((_, idx) => {
                                    const isActive = imageIndex === idx;
                                    return (
                                        <button
                                            key={idx}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSlideDirection(idx > imageIndex ? 1 : -1);
                                                setImageIndex(idx);
                                                setActiveImage(product.images[idx]);
                                            }}
                                            className={cn(
                                                "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                                                isActive ? "w-4 bg-primary" : "w-1.5 bg-slate-300"
                                            )}
                                        />
                                    );
                                })}
                            </div>
                        )}

                        {/* Slider Nav Arrows */}
                        {product.images && product.images.length > 1 && (
                            <>
                                <button
                                    onClick={handlePrevImage}
                                    className="absolute left-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/80 hover:bg-white text-slate-800 shadow-md transition-all active:scale-90 z-10 cursor-pointer"
                                >
                                    <ChevronLeft size={20} strokeWidth={2.5} />
                                </button>
                                <button
                                    onClick={handleNextImage}
                                    className="absolute right-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/80 hover:bg-white text-slate-800 shadow-md transition-all active:scale-90 z-10 cursor-pointer"
                                >
                                    <ChevronRight size={20} strokeWidth={2.5} />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="lg:w-[55%] xl:w-[60%] space-y-6 md:space-y-8">
                    {/* Rotating Ingredients Strip */}
                    <div className="bg-slate-50 border border-slate-100/80 py-3 px-5 flex items-center justify-center rounded-2xl shadow-sm">
                        <div className="flex-1 flex justify-center items-center h-6 overflow-hidden">
                            <AnimatePresence mode="wait">
                                <motion.span
                                    key={activeIngredientIdx}
                                    initial={{ y: 15, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: -15, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="font-extrabold text-slate-700 text-xs uppercase tracking-wider text-center"
                                >
                                    ✨ {ingredientsList[activeIngredientIdx] || "Natural Formula"}
                                </motion.span>
                            </AnimatePresence>
                        </div>
                    </div>

                    <div>
                        <h1 ref={titleRef} className="text-xl md:text-2xl font-bold text-slate-800 leading-tight tracking-tight mb-2 mt-2 font-sans">
                            {product.name}
                        </h1>

                        {/* Mobile Specific Rating, USP & Price details */}
                        <div className="md:hidden space-y-3 pt-2">
                            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                                <span>{reviews.length > 0 ? reviewBreakdown.avg : '0'}</span>
                                <Star size={11} className="fill-orange-400 text-orange-400 shrink-0" />
                                <span className="text-blue-500 font-bold">
                                    {reviews.length > 0 ? `${reviews.length} Review${reviews.length > 1 ? 's' : ''}` : 'No reviews yet'}
                                </span>
                            </div>

                            <div className="text-[11px] font-semibold text-slate-600">
                                Net Content: <span className="font-extrabold text-slate-800">{netContentInfo.content}</span> (USP: <span className="font-extrabold text-slate-800">{netContentInfo.usp}</span>)
                            </div>

                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-slate-900">₹{activePrice}</span>
                                {activeOriginalPrice > activePrice && (
                                    <>
                                        <span className="text-[11px] text-slate-400 font-semibold line-through">MRP: ₹{activeOriginalPrice}</span>
                                        <span className="text-[11px] text-[#ff2c38] font-extrabold uppercase tracking-wide">
                                            {activeDiscountPercent}% off
                                        </span>
                                    </>
                                )}
                                <span className="text-[10px] text-slate-400 italic font-semibold ml-1">Incl. of all taxes</span>
                            </div>
                        </div>

                        {/* Desktop Only Rating, Category & Price Block */}
                        <div className="hidden md:flex items-center gap-3 mb-6 mt-4">
                            <span className="bg-brand-50 border border-[#e2e8f0] text-primary px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider">
                                {product.categoryId?.name || 'Essential'}
                            </span>
                            <div className="flex items-center gap-1.5 text-orange-500 font-extrabold bg-orange-50 border border-orange-100/50 px-3.5 py-1.5 rounded-full text-xs shadow-sm">
                                <Star size={13} fill="currentColor" /> {reviews.length > 0 ? `${reviewBreakdown.avg} (${reviews.length})` : '0 (No reviews yet)'}
                            </div>
                        </div>

                        <div className="hidden md:block relative overflow-hidden rounded-[2.5rem] border border-brand-100/50 shadow-[0_12px_40px_rgba(0,0,0,0.02)] p-6 md:p-8 mb-6 bg-gradient-to-tr from-brand-50/70 to-white/90 backdrop-blur-md">
                            <div className="absolute top-0 right-0 w-36 h-36 bg-brand-500/5 rounded-full blur-3xl" />
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Best Price</span>
                                <div className="flex items-baseline gap-4">
                                    <span className="text-4xl md:text-5xl font-black text-primary tracking-tight">₹{product.salePrice || product.price}</span>
                                    {(product.salePrice && product.salePrice < product.price) && (
                                        <span className="text-lg md:text-xl text-slate-400 line-through font-bold">₹{product.price}</span>
                                    )}
                                    {product.salePrice && product.salePrice < product.price && (
                                        <span className="text-xs bg-red-50 border border-red-100 text-red-500 px-2.5 py-1.5 rounded-xl font-black uppercase tracking-wide">
                                            {Math.round(((product.price - product.salePrice) / product.price) * 100)}% OFF
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <p className="hidden md:block text-slate-500 text-xs md:text-sm leading-relaxed mb-6 font-normal max-w-2xl font-sans mt-4 whitespace-pre-line">
                            {cleanedDescription || "Fresh and premium quality product sourced directly from local vendors."}
                        </p>
                    </div>

                    {/* Desktop Only / Inline Quantity Adjuster */}
                    <div className="hidden md:flex flex-col sm:flex-row items-center gap-6 p-6 md:p-8 bg-white/70 border border-slate-100/80 rounded-[2.5rem] shadow-[0_10px_30px_rgba(0,0,0,0.02)] backdrop-blur-sm">
                        {quantity > 0 ? (
                            <div className="flex items-center bg-primary text-primary-foreground rounded-2xl h-16 w-full sm:w-auto px-2 shadow-xl shadow-brand-500/20 border border-brand-400/20">
                                <button
                                    onClick={() => updateQuantity(product.id, -1, selectedVariant?.sku || defaultVariant?.sku || "")}
                                    className="w-12 h-12 flex items-center justify-center hover:bg-white/20 rounded-xl transition-all active:scale-90"
                                >
                                    <Minus size={20} strokeWidth={3} />
                                </button>
                                <span className="w-16 text-center font-black text-xl">{quantity}</span>
                                <button
                                    onClick={() => updateQuantity(product.id, 1, selectedVariant?.sku || defaultVariant?.sku || "")}
                                    className="w-12 h-12 flex items-center justify-center hover:bg-white/20 rounded-xl transition-all active:scale-90"
                                >
                                    <Plus size={20} strokeWidth={3} />
                                </button>
                            </div>
                        ) : (
                            <Button
                                onClick={handleAddToCart}
                                className="h-16 w-full sm:w-64 bg-primary hover:bg-[var(--brand-400)] text-white text-lg font-black rounded-2xl shadow-xl shadow-brand-500/20 hover:shadow-brand-500/30 hover:brightness-105 active:scale-[0.98] transition-all duration-300 cursor-pointer"
                            >
                                <Plus className="mr-2" size={24} strokeWidth={3} /> ADD TO CART
                            </Button>
                        )}

                        <div className="flex flex-col gap-1.5 text-center sm:text-left shrink-0">
                            <span className="text-xs font-black text-primary uppercase tracking-widest flex items-center justify-center sm:justify-start gap-1.5">
                                <ShieldCheck size={16} /> Quality Guaranteed
                            </span>
                            <span className="text-sm font-bold text-slate-400 flex items-center justify-center sm:justify-start gap-1.5">
                                <Clock size={16} /> Delivered in 10-15 mins
                            </span>
                        </div>
                    </div>

                    <div className="hidden md:grid grid-cols-3 gap-4">
                        <div className="bg-white/80 p-5 rounded-[1.75rem] border border-slate-100 shadow-sm text-center transition-all hover:shadow-md hover:bg-white">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Weight</p>
                            <p className="text-base font-black text-slate-800">{activeVariant?.name || product.weight || '1 unit'}</p>
                        </div>
                        <div className="bg-white/80 p-5 rounded-[1.75rem] border border-slate-100 shadow-sm text-center transition-all hover:shadow-md hover:bg-white">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Stock</p>
                            <p className="text-base font-black text-slate-800">{product.stock > 0 ? 'In Stock' : 'Out of Stock'}</p>
                        </div>
                        <div className="bg-white/80 p-5 rounded-[1.75rem] border border-slate-100 shadow-sm text-center transition-all hover:shadow-md hover:bg-white">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Brand</p>
                            <p className="text-base font-black text-slate-800">{product.brand || 'Premium'}</p>
                        </div>
                    </div>

                    {/* Mobile Specific Sections (Select Size, Delivery, Badges) */}
                    <div className="md:hidden space-y-6 mt-6 pt-6 border-t border-slate-100">
                        {/* Select Size */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Select Size</h3>
                            <div className="flex gap-4 overflow-x-auto pt-5 pb-3 scrollbar-hide -mx-4 px-4">
                                {displayVariants.map((v, idx) => {
                                    const isSelected = selectedVariant ? selectedVariant.sku === v.sku : defaultVariant?.sku === v.sku;
                                    const isOutOfStock = v.stock <= 0;
                                    const priceVal = Number(v.salePrice || v.price || 0);
                                    const originalVal = Number(v.price || 0);
                                    const discountVal = originalVal > priceVal ? Math.round(((originalVal - priceVal) / originalVal) * 100) : 0;
                                    
                                    // USP calculation
                                    const numMatch = v.name.match(/(\d+(?:\.\d+)?)\s*(ml|g|kg|l|pcs|unit)/i);
                                    let uspStr = "";
                                    if (numMatch) {
                                        const val = parseFloat(numMatch[1]);
                                        const unit = numMatch[2].toLowerCase();
                                        uspStr = `(₹${(priceVal / (val || 1)).toFixed(2)} / ${unit === 'g' || unit === 'ml' ? 'ml' : 'unit'})`;
                                    }

                                    const badgeLabel = isOutOfStock ? "Out of stock" : discountVal > 0 ? `${discountVal}% OFF` : "";

                                    return (
                                        <button
                                            key={v.sku || idx}
                                            onClick={() => !isOutOfStock && setSelectedVariant(v)}
                                            className={cn(
                                                "relative flex-shrink-0 w-40 p-4 rounded-2xl bg-white border text-left transition-all duration-300 overflow-visible",
                                                isSelected 
                                                    ? "border-primary shadow-md shadow-brand-500/5 ring-1 ring-primary"
                                                    : "border-slate-200/80 hover:border-slate-300",
                                                isOutOfStock && "opacity-60 cursor-not-allowed bg-slate-50/50"
                                            )}
                                        >
                                            {/* Variant Badge */}
                                            {badgeLabel && (
                                                <div className={cn(
                                                    "absolute top-0 left-0 -translate-y-1/2 px-2.5 py-0.5 rounded-r-md rounded-tl-md text-[8px] font-black uppercase tracking-wider text-white",
                                                    isOutOfStock ? "bg-slate-400" : "bg-[#00b259]"
                                                )}>
                                                    {badgeLabel}
                                                </div>
                                            )}

                                            {/* Selected Checkmark */}
                                            {isSelected && (
                                                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-4 h-4 bg-primary rounded-full flex items-center justify-center text-white border-2 border-white shadow-sm z-10">
                                                    <svg className="w-2 h-2 fill-current" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z"/></svg>
                                                </div>
                                            )}

                                            <div className="mt-1.5 font-bold text-slate-800 text-xs">{v.name}</div>
                                            
                                            <div className="flex items-baseline gap-1 mt-1">
                                                <span className="font-extrabold text-slate-900 text-xs">₹{priceVal}</span>
                                                {originalVal > priceVal && (
                                                    <span className="text-[9px] text-slate-400 line-through">MRP: ₹{originalVal}</span>
                                                )}
                                            </div>

                                            <div className="text-[9px] text-slate-500 font-semibold mt-0.5">{uspStr}</div>
                                            
                                            <div className={cn(
                                                "text-[9px] font-black mt-2",
                                                isOutOfStock ? "text-slate-400" : "text-[#00b259]"
                                            )}>
                                                {isOutOfStock ? "Out of stock" : "In stock"}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Delivery Estimate Box */}
                        <div className="bg-white border border-slate-200/60 rounded-[2rem] p-5 shadow-sm space-y-4">
                            <div>
                                <h4 className="text-xs font-bold text-slate-800 leading-tight">80% orders gets delivered in 1-day</h4>
                                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Get estimated delivery date</p>
                            </div>

                            {/* Pincode Input */}
                            <div className="relative flex items-center border border-slate-200 rounded-2xl bg-slate-50/30 overflow-hidden">
                                <MapPin size={16} className="absolute left-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Enter your pincode"
                                    className="w-full pl-10 pr-20 py-3 text-xs font-semibold text-slate-800 outline-none bg-transparent"
                                />
                                <button className="absolute right-4 text-xs font-bold text-primary hover:brightness-95 active:scale-95 transition-transform cursor-pointer">
                                    Check
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-50/50 flex items-center justify-center text-slate-500 shrink-0">
                                        <RotateCcw size={14} />
                                    </div>
                                    <div className="leading-tight">
                                        <div className="text-[10px] font-bold text-slate-800">7 days</div>
                                        <div className="text-[8px] text-slate-400 font-semibold">return and refund</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-50/50 flex items-center justify-center text-slate-500 shrink-0">
                                        <Truck size={14} />
                                    </div>
                                    <div className="leading-tight">
                                        <div className="text-[10px] font-bold text-slate-800">FREE Shipping</div>
                                        <div className="text-[8px] text-slate-400 font-semibold">on orders above ₹399</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Natural Credentials Badges */}
                        <div className="flex gap-4 overflow-x-auto pt-2 pb-2 -mx-4 px-4 scrollbar-hide">
                            <div className="flex-shrink-0 w-64 p-4 rounded-3xl bg-white border border-rose-100/80 flex justify-between items-center gap-3 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
                                <div className="leading-tight">
                                    <div className="text-xs font-black text-slate-800">Toxin free and</div>
                                    <div className="text-xs font-black text-slate-800">natural ingredients</div>
                                    <div className="text-[10px] text-slate-400 font-bold mt-1 leading-normal">
                                        Top ingredients are used for beauty specifically for indian users.
                                    </div>
                                </div>
                                <div className="text-3xl shrink-0 filter drop-shadow-sm">
                                    🌺
                                </div>
                            </div>
                            <div className="flex-shrink-0 w-64 p-4 rounded-3xl bg-white border border-emerald-100/80 flex justify-between items-center gap-3 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
                                <div className="leading-tight">
                                    <div className="text-xs font-black text-slate-800">Tree plantation</div>
                                    <div className="text-xs font-black text-slate-800">for every order</div>
                                    <div className="text-[10px] text-slate-400 font-bold mt-1 leading-normal">
                                        We plant a tree for every order placed to support a greener environment.
                                    </div>
                                </div>
                                <div className="text-3xl shrink-0 filter drop-shadow-sm">
                                    🌳
                                </div>
                            </div>
                        </div>

                        {/* Ratings Disclaimer */}
                        <div className="text-[9px] text-[#8fa67c] font-bold italic leading-tight px-1 -mt-2">
                            *Ratings given on Veenolex website and other third party website.
                        </div>

                        {/* Product Description */}
                        <div className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                            <div className="bg-[#e9fbdb] px-4 py-3 border-b border-slate-200/40">
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Product Description</h4>
                            </div>
                            <div className="p-4 text-xs font-semibold text-slate-600 leading-relaxed font-sans whitespace-pre-line">
                                {cleanedDescription || "Fresh and premium quality product sourced directly from local vendors."}
                            </div>
                        </div>

                        {/* Results Section */}
                        <div className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                            <div className="bg-[#e9fbdb] px-4 py-3 border-b border-slate-200/40">
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Results</h4>
                            </div>
                            <div className="p-4">
                                {product.resultImages && product.resultImages.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        {product.resultImages.map((imgUrl, index) => (
                                            <div 
                                                key={index} 
                                                className="relative aspect-square rounded-xl overflow-hidden border border-slate-100 shadow-sm cursor-pointer hover:scale-[1.02] active:scale-95 transition-all duration-300 group"
                                                onClick={() => {
                                                    setLightboxImages(product.resultImages);
                                                    setLightboxIndex(index);
                                                    setIsLightboxOpen(true);
                                                }}
                                            >
                                                <img 
                                                    src={applyCloudinaryTransform(imgUrl, "f_auto,q_auto,w_500")} 
                                                    alt={`Result ${index + 1}`} 
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                    loading="lazy"
                                                />
                                                <div className="absolute inset-0 bg-black/5 group-hover:bg-black/0 transition-colors duration-300" />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-2">
                                        <div className="border border-dashed border-slate-200 bg-slate-50/50 rounded-xl min-h-[200px] flex flex-col items-center justify-center text-center p-4">
                                            <div className="text-3xl filter grayscale opacity-30 mb-2">📊</div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Results Area</p>
                                            <p className="text-[9px] font-bold text-slate-400/80 max-w-[180px] leading-normal mt-1">
                                                Space reserved for dynamic product benefit and results images.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tabbed Info Section (Key Ingredients, How to use, Suitable For) */}
                        <div className="space-y-4">
                            {/* Tabs Header */}
                            <div className="flex gap-2 overflow-x-auto pt-2 pb-1.5 scrollbar-hide -mx-4 px-4">
                                {activeTabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveSectionTab(tab.id)}
                                        className={cn(
                                            "flex-shrink-0 border px-5 py-2.5 rounded-full text-xs font-black tracking-wide transition-all duration-200 outline-none cursor-pointer",
                                            activeSectionTab === tab.id
                                                ? "border-primary bg-white text-primary shadow-sm ring-1 ring-primary"
                                                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                                        )}
                                    >
                                        {tab.title}
                                    </button>
                                ))}
                            </div>

                            {/* Active Tab Content Area */}
                            <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm shadow-black/5 animate-in fade-in duration-300">
                                {activeTabs.map((tab) => {
                                    if (activeSectionTab !== tab.id) return null;
                                    
                                    // If fallback ingredients list (array of objects)
                                    if (tab.id === 'ingredients' && Array.isArray(tab.content)) {
                                        return (
                                            <div key={tab.id} className="space-y-4">
                                                {tab.content.map((ing, idx) => (
                                                    <div key={idx} className="flex flex-col gap-1.5 pb-3 last:pb-0 border-b border-slate-100 last:border-0">
                                                        <div className="text-xs font-black text-emerald-600 text-left">{ing.name}:</div>
                                                        <p className="text-[11px] font-semibold text-slate-600 leading-normal text-left">{ing.description}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }

                                    // If string content (custom or fallback description text)
                                    if (typeof tab.content === 'string') {
                                        const lines = tab.content.split('\n').map(l => l.trim()).filter(Boolean);
                                        return (
                                            <div key={tab.id} className="space-y-4">
                                                {lines.map((line, lineIdx) => {
                                                    const colonIdx = line.indexOf(':');
                                                    if (colonIdx > 0 && colonIdx < 35) {
                                                        const header = line.substring(0, colonIdx).trim();
                                                        const desc = line.substring(colonIdx + 1).trim();
                                                        return (
                                                            <div key={lineIdx} className="flex flex-col gap-1.5 pb-3 last:pb-0 border-b border-slate-100 last:border-0">
                                                                <div className="text-xs font-black text-emerald-600 text-left">{header}:</div>
                                                                <p className="text-[11px] font-semibold text-slate-600 leading-normal text-left">{desc}</p>
                                                            </div>
                                                        );
                                                    }
                                                    return (
                                                        <p key={lineIdx} className="text-xs font-semibold text-slate-600 leading-normal text-left pb-2 last:pb-0">
                                                            {line}
                                                        </p>
                                                    );
                                                })}
                                            </div>
                                        );
                                    }

                                    return null;
                                })}
                            </div>
                        </div>

                        {/* Additional Information (Collapsible) */}
                        <div className="bg-white border-t border-slate-100 px-4">
                            <button
                                onClick={() => setIsAdditionalInfoOpen(!isAdditionalInfoOpen)}
                                className="w-full flex items-center justify-between py-4 text-left focus:outline-none cursor-pointer"
                            >
                                <span className="text-sm font-black text-[#00aeef] uppercase tracking-wider">Additional Information</span>
                                <ChevronRight 
                                    size={18} 
                                    className={cn(
                                        "text-[#00aeef] transition-transform duration-300",
                                        isAdditionalInfoOpen ? "rotate-90" : ""
                                    )} 
                                />
                            </button>

                            {isAdditionalInfoOpen && (
                                <div className="space-y-4 pb-5 pt-1 text-xs animate-in fade-in duration-300">
                                    <div className="space-y-1">
                                        <div className="font-extrabold text-[10px] text-slate-800 uppercase tracking-wider">Manufactured By</div>
                                        <div className="font-medium text-slate-500 leading-relaxed">
                                            {dynamicAdditionalInfo.manufacturedBy}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="font-extrabold text-[10px] text-slate-800 uppercase tracking-wider">Marketed By</div>
                                        <div className="font-medium text-slate-500 leading-relaxed">
                                            {dynamicAdditionalInfo.marketedBy}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <div className="font-extrabold text-[10px] text-slate-800 uppercase tracking-wider">Best Before</div>
                                            <div className="font-medium text-slate-500">
                                                {dynamicAdditionalInfo.bestBefore}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="font-extrabold text-[10px] text-slate-800 uppercase tracking-wider">License No</div>
                                            <div className="font-medium text-slate-500 leading-relaxed">
                                                {dynamicAdditionalInfo.licenseNo}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Extra Dynamic Info to provide maximum dynamic context */}
                                    <div className="grid grid-cols-2 gap-y-3 gap-x-4 pt-3 border-t border-dashed border-slate-100 text-[10px]">
                                        <div className="space-y-1">
                                            <div className="font-extrabold text-[9px] text-slate-400 uppercase tracking-wider">Brand</div>
                                            <div className="font-semibold text-slate-600 capitalize">{dynamicAdditionalInfo.brand}</div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="font-extrabold text-[9px] text-slate-400 uppercase tracking-wider">SKU</div>
                                            <div className="font-semibold text-slate-600">{dynamicAdditionalInfo.sku}</div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="font-extrabold text-[9px] text-slate-400 uppercase tracking-wider">Net Content</div>
                                            <div className="font-semibold text-slate-600">{dynamicAdditionalInfo.weight}</div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="font-extrabold text-[9px] text-slate-400 uppercase tracking-wider">Seller Shop</div>
                                            <div className="font-semibold text-slate-600">{dynamicAdditionalInfo.seller}</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Thick Mobile Section Divider */}
                        <div className="h-[8px] bg-slate-100 -mx-4" />

                        {/* Ratings And Reviews Mobile Dashboard */}
                        <div className="space-y-4 px-4 py-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-900 font-sans tracking-tight">Rating And Reviews</h3>
                                <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                                    <span className="w-3.5 h-3.5 bg-sky-500 rounded-full flex items-center justify-center text-white text-[9px] shrink-0 font-bold">✓</span>
                                    <span>Only verified users</span>
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex items-center gap-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                                {/* Left Side: Avg Score */}
                                <div className="w-[35%] flex flex-col items-center justify-center border-r border-slate-100 pr-5 text-center shrink-0">
                                    <div className="bg-[#57b81d] text-white px-3 py-1.5 rounded-lg flex items-center justify-center gap-1 font-black text-2xl shadow-sm">
                                        <span>{reviewBreakdown.avg}</span>
                                        <Star size={16} fill="currentColor" stroke="none" className="text-white" />
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-400 mt-2 block">
                                        {reviewBreakdown.total} Reviews
                                    </span>
                                </div>

                                {/* Right Side: Star breakdown bars */}
                                <div className="flex-1 space-y-1">
                                    {[5, 4, 3, 2, 1].map((star) => {
                                        const count = reviewBreakdown[star];
                                        const percent = reviewBreakdown.total > 0 ? (count / reviewBreakdown.total) * 100 : 0;
                                        return (
                                            <div key={star} className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold">
                                                <span className="w-2 text-right">{star}</span>
                                                <Star size={10} fill="currentColor" stroke="none" className="text-slate-300 shrink-0" />
                                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-[#fcb301] rounded-full" 
                                                        style={{ width: `${percent}%` }}
                                                    />
                                                </div>
                                                <span className="w-8 text-right text-slate-400 font-medium">{count}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Appreciate Feedback / Write Review Form */}
                            <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm shadow-black/5 text-center space-y-4">
                                <h4 className="text-sm font-bold text-slate-800 tracking-tight">We'd Really Appreciate Your Feedback</h4>
                                
                                {/* 5 Stars selector */}
                                <div className="flex justify-center gap-3">
                                    {[1, 2, 3, 4, 5].map((star) => {
                                        const isSelected = newReview.rating >= star && hasInteractedWithFeedback;
                                        return (
                                            <button
                                                key={star}
                                                type="button"
                                                onClick={() => {
                                                    setNewReview(prev => ({ ...prev, rating: star }));
                                                    setHasInteractedWithFeedback(true);
                                                }}
                                                className="outline-none focus:outline-none transition-transform active:scale-90 cursor-pointer"
                                            >
                                                <Star 
                                                    size={38} 
                                                    className={cn(
                                                        "transition-all duration-200",
                                                        isSelected 
                                                            ? "text-[#fcb301] fill-[#fcb301]" 
                                                            : "text-slate-300 stroke-[1.2]"
                                                    )} 
                                                />
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Animated Form input */}
                                <AnimatePresence>
                                    {hasInteractedWithFeedback && (
                                        <motion.div 
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="overflow-hidden space-y-3 pt-2 text-left"
                                        >
                                            <textarea
                                                value={newReview.comment}
                                                onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))}
                                                placeholder="Tell us what you liked or disliked about this product..."
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs font-semibold min-h-[90px] outline-none focus:border-primary/50 focus:bg-white transition-all shadow-inner"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleReviewSubmit}
                                                disabled={isSubmittingReview || !newReview.comment.trim()}
                                                className="w-full h-11 bg-primary text-white text-xs font-black rounded-xl shadow-sm uppercase tracking-wider active:scale-95 transition-transform disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                                            >
                                                {isSubmittingReview ? "Submitting..." : "Submit Feedback"}
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Mobile Customer Reviews List */}
                            {reviews.length > 0 && (
                                <div className="space-y-3 pt-2">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider px-1">Customer Reviews ({reviews.length})</h4>
                                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                                        {reviews.map((review) => (
                                            <div key={review._id} className="p-4 rounded-2xl bg-white border border-slate-200/50 shadow-sm shadow-black/5 space-y-2">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-8 w-8 rounded-full bg-brand-50 border border-brand-100/30 flex items-center justify-center font-black text-primary text-xs shrink-0">
                                                            {review.userId?.name?.[0]?.toUpperCase() || "?"}
                                                        </div>
                                                        <div>
                                                            <h5 className="font-black text-slate-800 text-[10px] leading-tight">{review.userId?.name || "Anonymous"}</h5>
                                                            <div className="flex items-center gap-0.5 mt-0.5">
                                                                {[...Array(5)].map((_, i) => (
                                                                    <Star
                                                                        key={i}
                                                                        size={9}
                                                                        className={cn(i < review.rating ? "text-amber-400 fill-amber-400" : "text-slate-200")}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span className="text-[8px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{new Date(review.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-slate-600 font-semibold leading-relaxed text-[11px] font-sans">{review.comment}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Certifications and Badges Row */}
                        <div className="bg-white pt-6 pb-4 border-t border-slate-100">
                            <div className="grid grid-cols-4 gap-2 text-center">
                                <div className="space-y-2">
                                    <svg viewBox="0 0 100 100" className="w-12 h-12 mx-auto">
                                        <circle cx="50" cy="50" r="48" fill="#e9fbdb" stroke="#92d050" strokeWidth="3" />
                                        <path id="deriv-text-path" d="M 50,50 m -38,0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" fill="none" />
                                        <text className="text-[7px] font-extrabold fill-[#478207] tracking-widest uppercase">
                                            <textPath href="#deriv-text-path" startOffset="50%" textAnchor="middle">
                                                Dermatologically Tested • Safe •
                                            </textPath>
                                        </text>
                                        <path d="M50 30 C45 35 45 45 50 55 C55 45 55 35 50 30" fill="#478207" />
                                        <path d="M35 55 C40 52 45 52 50 55 C55 58 60 58 65 55 C58 62 42 62 35 55 Z" fill="#70ad47" />
                                    </svg>
                                    <div className="text-[9px] font-bold text-slate-600 leading-tight">Dermatologically Tested</div>
                                </div>
                                <div className="space-y-2">
                                    <svg viewBox="0 0 100 100" className="w-12 h-12 mx-auto">
                                        <circle cx="50" cy="50" r="46" fill="none" stroke="#2e7d32" strokeWidth="3" />
                                        <circle cx="50" cy="50" r="40" fill="none" stroke="#2e7d32" strokeWidth="1" strokeDasharray="2 2" />
                                        <circle cx="50" cy="50" r="38" fill="#e8f5e9" />
                                        <text x="50" y="46" textAnchor="middle" className="text-[20px] font-black fill-[#2e7d32]">FDA</text>
                                        <text x="50" y="62" textAnchor="middle" className="text-[8px] font-extrabold fill-[#2e7d32] tracking-wider uppercase">APPROVED</text>
                                        <path d="M25 50 L35 50 M65 50 L75 50" stroke="#2e7d32" strokeWidth="2" />
                                    </svg>
                                    <div className="text-[9px] font-bold text-slate-600 leading-tight">FDA Approved</div>
                                </div>
                                <div className="space-y-2">
                                    <svg viewBox="0 0 100 100" className="w-12 h-12 mx-auto">
                                        <circle cx="50" cy="50" r="46" fill="#e0f2f1" stroke="#00acc1" strokeWidth="3" />
                                        <path id="made-safe-path" d="M 50,50 m -36,0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" fill="none" />
                                        <text className="text-[7.5px] font-extrabold fill-[#006064] tracking-widest uppercase">
                                            <textPath href="#made-safe-path" startOffset="50%" textAnchor="middle">
                                                Made Safe • Certified •
                                            </textPath>
                                        </text>
                                        <path d="M50 32 C43 38 43 48 50 56 C57 48 57 38 50 32 Z" fill="#00838f" />
                                        <path d="M47 42 L53 42 M46 48 L54 48" stroke="#e0f2f1" strokeWidth="1.5" />
                                    </svg>
                                    <div className="text-[9px] font-bold text-slate-600 leading-tight">Made Safe Certified</div>
                                </div>
                                <div className="space-y-2">
                                    <svg viewBox="0 0 100 100" className="w-12 h-12 mx-auto">
                                        <circle cx="50" cy="50" r="46" fill="#e8f5e9" stroke="#7cb342" strokeWidth="3" />
                                        <path id="cruelty-free-path" d="M 50,50 m -36,0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" fill="none" />
                                        <text className="text-[7.5px] font-extrabold fill-[#33691e] tracking-wider uppercase">
                                            <textPath href="#cruelty-free-path" startOffset="50%" textAnchor="middle">
                                                Cruelty Free • 100% Vegan •
                                            </textPath>
                                        </text>
                                        <path d="M42 32 C38 22 45 22 46 32 C47 22 54 22 50 32 C48 38 48 44 48 48 L52 48 C52 44 52 38 50 32" fill="none" stroke="#558b2f" strokeWidth="3.5" strokeLinecap="round" />
                                        <path d="M50 44 C42 46 38 52 42 62 C46 68 54 68 58 62 C62 52 58 46 50 44 Z" fill="#558b2f" />
                                    </svg>
                                    <div className="text-[9px] font-bold text-slate-600 leading-tight">Cruelty Free</div>
                                </div>
                            </div>
                        </div>

                        {/* Thick Mobile Section Divider */}
                        <div className="h-[8px] bg-slate-100 -mx-4" />

                        {/* Payment and Secure Details */}
                        <div className="bg-white pt-6 pb-4 space-y-5">
                            <div className="text-center space-y-3">
                                <h4 className="text-xs font-bold text-slate-800 tracking-wider uppercase">Pay Using</h4>
                                
                                <div className="space-y-2 px-4 max-w-sm mx-auto">
                                    {/* Row 1 */}
                                    <div className="flex justify-center gap-2">
                                        <div className="w-[62px] h-9 bg-white border border-slate-200 rounded-md flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-1 shrink-0">
                                            <div className="flex flex-col items-center justify-center leading-none">
                                                <span className="text-[11px] font-black tracking-tighter text-slate-800 flex items-center">
                                                    UPI<span className="text-emerald-500 font-extrabold ml-0.5">▶</span>
                                                </span>
                                                <span className="text-[4.5px] text-slate-400 font-bold uppercase tracking-[0.1em] mt-0.5">Payments</span>
                                            </div>
                                        </div>
                                        <div className="w-[62px] h-9 bg-white border border-slate-200 rounded-md flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-1 shrink-0">
                                            <div className="flex items-center gap-0.5">
                                                <div className="w-3.5 h-3.5 bg-[#5f259f] rounded flex items-center justify-center shrink-0">
                                                    <span className="text-white text-[8px] font-bold">pe</span>
                                                </div>
                                                <span className="text-[8px] font-black text-[#5f259f] tracking-tight">PhonePe</span>
                                            </div>
                                        </div>
                                        <div className="w-[62px] h-9 bg-white border border-slate-200 rounded-md flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-1 shrink-0">
                                            <div className="flex flex-col items-center justify-center">
                                                <span className="text-[11px] font-black text-amber-500 tracking-tighter leading-none">pay</span>
                                                <span className="text-[5px] text-slate-400 font-bold leading-none mt-0.5">SECURE</span>
                                            </div>
                                        </div>
                                        <div className="w-[62px] h-9 bg-white border border-slate-200 rounded-md flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-1 shrink-0">
                                            <div className="w-4.5 h-4.5 bg-orange-500 rounded-full flex items-center justify-center shrink-0">
                                                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white fill-current">
                                                    <path d="M19 9h-4V3H9v8h4v10z" />
                                                </svg>
                                            </div>
                                        </div>
                                        <div className="w-[62px] h-9 bg-white border border-slate-200 rounded-md flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-1 shrink-0">
                                            <div className="flex items-center gap-0.5">
                                                <div className="w-3.5 h-3.5 bg-teal-500 rounded-sm flex items-center justify-center font-bold text-white text-[9px] shrink-0">M</div>
                                                <span className="text-[7.5px] font-bold text-slate-600">wallet</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 2 */}
                                    <div className="flex justify-center gap-2">
                                        <div className="w-[62px] h-9 bg-white border border-slate-200 rounded-md flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-1 shrink-0">
                                            <span className="text-blue-800 font-black text-xs italic tracking-tight font-serif">VISA</span>
                                        </div>
                                        <div className="w-[62px] h-9 bg-white border border-slate-200 rounded-md flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-1 shrink-0">
                                            <div className="flex items-center justify-center">
                                                <div className="w-3 h-3 rounded-full bg-[#eb001b] -mr-1 opacity-90"></div>
                                                <div className="w-3 h-3 rounded-full bg-[#ff5f00] opacity-90"></div>
                                            </div>
                                        </div>
                                        <div className="w-[62px] h-9 bg-[#0070d2] border border-blue-600 rounded-md flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-1 shrink-0">
                                            <span className="text-white font-extrabold text-[7.5px] tracking-wider">AMEX</span>
                                        </div>
                                        <div className="w-[62px] h-9 bg-white border border-slate-200 rounded-md flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-1 shrink-0">
                                            <div className="flex flex-col items-center justify-center leading-none">
                                                <span className="text-[8.5px] font-black italic text-blue-900 tracking-tighter">RuPay<span className="text-orange-500">❯</span></span>
                                            </div>
                                        </div>
                                        <div className="w-[62px] h-9 bg-white border border-slate-200 rounded-md flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-1 shrink-0 text-center leading-none">
                                            <span className="text-[5.5px] font-black text-slate-700 tracking-wider">NET BANKING</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="text-center space-y-2 pt-2 border-t border-slate-100">
                                <h4 className="text-[11px] font-semibold text-slate-500 tracking-wide">100% Secure Payment</h4>
                                <div className="flex justify-center">
                                    <svg viewBox="0 0 100 60" className="w-14 h-8 text-slate-400">
                                        <rect x="25" y="10" width="50" height="30" rx="3" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" />
                                        <line x1="25" y1="18" x2="75" y2="18" stroke="#94a3b8" strokeWidth="4" />
                                        <rect x="15" y="20" width="50" height="30" rx="3" fill="#a7f3d0" stroke="#34d399" strokeWidth="1.5" />
                                        <rect x="22" y="26" width="10" height="7" rx="1" fill="#fcd34d" />
                                        <line x1="22" y1="40" x2="42" y2="40" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
                                        <line x1="22" y1="44" x2="32" y2="44" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
                                        <circle cx="70" cy="40" r="11" fill="#10b981" />
                                        <rect x="66" y="37" width="8" height="6" rx="1" fill="white" />
                                        <path d="M68 37 V34 C68 32.5 72 32.5 72 34 V37" fill="none" stroke="white" strokeWidth="1.2" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Social Links & Legal Info */}
                        <div className="bg-[#FAF9F4] py-6 px-4 space-y-4">
                            <div className="flex justify-center gap-5">
                                <a href="https://facebook.com" target="_blank" rel="noreferrer" className="text-slate-600 hover:text-primary transition-colors">
                                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                                        <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z" />
                                    </svg>
                                </a>
                                <a href="https://twitter.com" target="_blank" rel="noreferrer" className="text-slate-600 hover:text-primary transition-colors">
                                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                    </svg>
                                </a>
                                <a href="mailto:support@veenolex.com" className="text-slate-600 hover:text-primary transition-colors">
                                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                                        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                                    </svg>
                                </a>
                                <a href="https://instagram.com" target="_blank" rel="noreferrer" className="text-slate-600 hover:text-primary transition-colors">
                                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
                                    </svg>
                                </a>
                                <a href="https://youtube.com" target="_blank" rel="noreferrer" className="text-slate-600 hover:text-primary transition-colors">
                                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                                        <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.107C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.388.556a3.003 3.003 0 0 0-2.11 2.107C0 8.083 0 12 0 12s0 3.917.502 5.837a3.003 3.003 0 0 0 2.11 2.107C4.5 20.5 12 20.5 12 20.5s7.5 0 9.388-.556a3.003 3.003 0 0 0 2.11-2.107C24 15.917 24 12 24 12s0-3.917-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                                    </svg>
                                </a>
                                <a href="https://pinterest.com" target="_blank" rel="noreferrer" className="text-slate-600 hover:text-primary transition-colors">
                                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                                        <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.966 1.406-5.966s-.359-.72-.359-1.781c0-1.663.967-2.909 2.17-2.909 1.023 0 1.517.769 1.517 1.686 0 1.03-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.1.12.115.227.085.352-.093.386-.299 1.213-.34 1.378-.054.218-.179.265-.41.156-1.529-.711-2.484-2.946-2.484-4.743 0-3.864 2.808-7.411 8.093-7.411 4.248 0 7.55 3.027 7.55 7.074 0 4.22-2.66 7.619-6.352 7.619-1.24 0-2.409-.644-2.808-1.406 0 0-.613 2.333-.762 2.906-.277 1.066-1.025 2.402-1.525 3.216 1.126.347 2.316.536 3.546.536 6.62 0 11.986-5.366 11.986-11.987C23.999 5.368 18.63 0 12.017 0z" />
                                    </svg>
                                </a>
                            </div>

                            <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-4 pb-16 border-t border-slate-200/50 max-w-xs mx-auto flex items-center justify-center gap-2">
                                <Link to="/privacy" className="hover:underline hover:text-slate-600 transition-colors">Privacy Policy</Link>
                                <span>|</span>
                                <Link to="/terms" className="hover:underline hover:text-slate-600 transition-colors">Return Policy</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="hidden md:block mt-24 border-t border-slate-100/80 pt-16">
                <div className="flex flex-col lg:flex-row gap-12">
                    <div className="lg:w-[40%]">
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-[0_15px_40px_rgba(0,0,0,0.02)] sticky top-28">
                            <h3 className="text-2xl font-black text-slate-800 mb-2">Write a Review</h3>
                            <p className="text-slate-500 font-medium mb-6 text-sm">Share your experience with this product</p>

                            <form onSubmit={handleReviewSubmit} className="space-y-6">
                                <div className="space-y-3">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Your Rating</label>
                                    <div className="flex gap-2">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                type="button"
                                                onClick={() => setNewReview({ ...newReview, rating: star })}
                                                className={cn(
                                                    "h-12 w-12 rounded-2xl flex items-center justify-center transition-all shadow-sm border cursor-pointer",
                                                    newReview.rating >= star ? "bg-orange-50 border-orange-200 text-orange-500 animate-in zoom-in-50 duration-200" : "bg-slate-50/50 border-slate-100 text-slate-300 hover:border-slate-200"
                                                )}
                                            >
                                                <Star className={cn("h-6 w-6", newReview.rating >= star && "fill-current")} />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Comment</label>
                                    <textarea
                                        value={newReview.comment}
                                        onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                                        placeholder="What did you like or dislike?"
                                        className="w-full bg-slate-50/50 border border-slate-100/85 rounded-2xl p-4 text-sm font-bold min-h-[120px] outline-none focus:border-primary/50 focus:bg-white transition-all shadow-inner"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isSubmittingReview}
                                    className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl shadow-xl hover:shadow-black/10 transition-all active:scale-[0.98] uppercase tracking-widest text-xs cursor-pointer"
                                >
                                    {isSubmittingReview ? "SUBMITTING..." : "SUBMIT REVIEW"}
                                </Button>
                            </form>
                        </div>
                    </div>

                    <div className="lg:w-[60%] space-y-8">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-3xl font-black text-slate-800 tracking-tight">Customer Reviews</h3>
                            <div className="flex items-center gap-2 px-4 py-2 bg-brand-50 rounded-xl border border-brand-100/50 shadow-sm">
                                <MessageSquare size={16} className="text-primary" />
                                <span className="font-black text-primary text-xs uppercase tracking-wider">{reviews.length} Verified</span>
                            </div>
                        </div>

                        {reviewLoading ? (
                            <div className="flex justify-center p-20">
                                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : reviews.length > 0 ? (
                            <div className="space-y-6">
                                {reviews.map((review) => (
                                    <div key={review._id} className="p-8 rounded-[2rem] bg-white border border-slate-100/80 shadow-[0_15px_40px_rgba(0,0,0,0.02)] transition-all hover:shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-2xl bg-brand-50 border border-brand-100/30 flex items-center justify-center font-black text-primary text-xl">
                                                    {review.userId?.name?.[0]?.toUpperCase() || "?"}
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-slate-800 text-sm leading-tight">{review.userId?.name || "Anonymous"}</h4>
                                                    <div className="flex items-center gap-0.5 mt-1">
                                                        {[...Array(5)].map((_, i) => (
                                                            <Star
                                                                key={i}
                                                                size={12}
                                                                className={cn(i < review.rating ? "text-orange-400 fill-orange-400" : "text-slate-200")}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">{new Date(review.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-slate-600 font-medium leading-relaxed text-sm">{review.comment}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-20 text-center rounded-[3rem] bg-slate-50 border-2 border-dashed border-slate-200">
                                <p className="text-slate-400 font-black uppercase text-sm">No reviews yet. Be the first!</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Sticky Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] md:hidden">
                {/* Bottom Bar Content */}
                <div className="p-4 pb-6 flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Price</span>
                        <span className="text-xl font-black text-slate-900">
                            ₹{activePrice}
                        </span>
                    </div>

                    <div className="flex-1 max-w-[200px]">
                        {quantity > 0 ? (
                            <div className="flex items-center justify-between bg-primary text-primary-foreground rounded-xl h-12 px-2 shadow-md">
                                <button
                                    onClick={() => updateQuantity(product.id, -1, selectedVariant?.sku || defaultVariant?.sku || "")}
                                    className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-lg active:scale-90 transition-transform"
                                >
                                    <Minus size={16} strokeWidth={3} />
                                </button>
                                <span className="font-bold text-base">{quantity}</span>
                                <button
                                    onClick={() => updateQuantity(product.id, 1, selectedVariant?.sku || defaultVariant?.sku || "")}
                                    className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-lg active:scale-90 transition-transform"
                                >
                                    <Plus size={16} strokeWidth={3} />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleAddToCart}
                                className="w-full h-12 bg-primary hover:bg-[var(--brand-400)] text-white text-xs font-black rounded-xl shadow-md uppercase tracking-wider active:scale-95 transition-transform"
                            >
                                Add to cart
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Fullscreen Lightbox / Media Viewer */}
            <AnimatePresence>
                {isLightboxOpen && lightboxImages.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center"
                        onClick={() => setIsLightboxOpen(false)}
                    >
                        {/* Close button */}
                        <button 
                            className="absolute top-6 right-6 text-white/80 hover:text-white p-3 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all cursor-pointer z-[10000]"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsLightboxOpen(false);
                            }}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* Image Viewer */}
                        <div 
                            className="relative w-full max-w-4xl aspect-square md:aspect-video flex items-center justify-center px-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <motion.img 
                                key={lightboxIndex}
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                src={lightboxImages[lightboxIndex]}
                                alt="Expanded view" 
                                className="max-w-full max-h-[75vh] object-contain rounded-xl select-none"
                            />

                            {/* Left Navigation */}
                            {lightboxImages.length > 1 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length);
                                    }}
                                    className="absolute left-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 text-white cursor-pointer transition-all"
                                >
                                    <ChevronLeft size={24} strokeWidth={3} />
                                </button>
                            )}

                            {/* Right Navigation */}
                            {lightboxImages.length > 1 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setLightboxIndex((prev) => (prev + 1) % lightboxImages.length);
                                    }}
                                    className="absolute right-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 text-white cursor-pointer transition-all"
                                >
                                    <ChevronRight size={24} strokeWidth={3} />
                                </button>
                            )}
                        </div>

                        {/* Indicator Dots */}
                        {lightboxImages.length > 1 && (
                            <div className="absolute bottom-10 flex gap-2" onClick={(e) => e.stopPropagation()}>
                                {lightboxImages.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setLightboxIndex(idx)}
                                        className={cn(
                                            "h-2 rounded-full transition-all duration-300 cursor-pointer",
                                            lightboxIndex === idx ? "w-6 bg-primary" : "w-2 bg-white/30"
                                        )}
                                    />
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ProductDetailPage;
