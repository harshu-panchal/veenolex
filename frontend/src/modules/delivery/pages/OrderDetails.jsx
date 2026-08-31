import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/core/context/AuthContext";
import {
  Phone,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Navigation,
  Package,
  CheckCircle,
  Store,
  User,
  AlertTriangle,
  ShieldCheck,
  Truck,
  Calendar,
  XCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "@/shared/components/ui/Button";
import Card from "@/shared/components/ui/Card";
import { toast } from "sonner";
import { deliveryApi } from "../services/deliveryApi";
import { Loader2 } from "lucide-react";
import DeliveryTrackingMap from "../components/DeliveryTrackingMap";
import DeliverySlideButton from "../components/DeliverySlideButton";
import OtpInput from "../components/OtpInput";
import ReturnPickupProofUpload from "../components/ReturnPickupProofUpload";
import {
  getCachedDeliveryPartnerLocation,
  getCurrentPositionWithCache,
  getQuickDeliveryPosition,
} from "../utils/deliveryLastLocation";
import { createSocketTokenReader } from "@core/utils/authStorage";
import { STORAGE_KEYS } from "@core/utils/storage";
import {
  getOrderSocket,
  joinOrderRoom,
  leaveOrderRoom,
  onOrderStatusUpdate,
} from "@/core/services/orderSocket";

const getPublicStatusStage = (internalStep) => {
  if (internalStep >= 4) return 3;
  if (internalStep >= 3) return 2;
  return 1;
};

// Maps return backend status → 5-step UI
// Step 1: Accepted, navigate to customer
// Step 2: At customer, upload proof + customer OTP
// Step 3: In transit, navigate to seller
// Step 4: At seller, request seller OTP
// Step 5: Completed
const orderOfReturn = (s) => {
  if (!s || s === "none") return 1;
  const lower = s.toLowerCase();
  if (["returned", "qc_passed", "qc_failed", "refund_completed"].includes(lower)) return 5;
  if (lower === "return_drop_pending") return 4;
  if (lower === "return_in_transit") return 3;
  if (lower === "return_pickup_assigned") return 1;
  return 1; // return_approved also = 1
};

// Helper to unwrap nested order document structure if returned inside { order: ... }
const extractOrderDoc = (ord) => {
  if (!ord) return ord;
  const raw =
    ord.order && typeof ord.order === "object" && (ord.order.orderId || ord.order._id || ord.order.items)
      ? { ...ord.order, ...ord, order: undefined }
      : ord;
  return raw;
};

const PUBLIC_STATUS_STEPS = [
  { id: 1, label: "Confirmed" },
  { id: 2, label: "Out for Delivery" },
  { id: 3, label: "Delivered" },
];

const getPersistedRiderStep = (order) => {
  if (!order) return 1;

  // Handle Return Flow Steps (5-step UI)
  if (order.returnStatus && order.returnStatus !== "none") {
    const rs = order.returnStatus.toLowerCase();
    if (["returned", "qc_passed", "qc_failed", "refund_completed"].includes(rs)) return 5;
    if (rs === "return_drop_pending") return 4;
    if (rs === "return_in_transit") return 3;
    if (rs === "return_pickup_assigned" || rs === "return_approved") return 1;
  }

  const workflowStatus = String(order.workflowStatus || "").toUpperCase();
  const legacyStatus = String(order.status || "").toLowerCase();
  const riderStep = Number(order.deliveryRiderStep) || 0;

  if (
    riderStep >= 4 ||
    workflowStatus === "DELIVERED" ||
    legacyStatus === "delivered"
  ) {
    return 4;
  }

  if (
    riderStep >= 3 ||
    workflowStatus === "OUT_FOR_DELIVERY" ||
    legacyStatus === "out_for_delivery" ||
    order.outForDeliveryAt
  ) {
    return 3;
  }

  if (
    riderStep >= 2 ||
    workflowStatus === "PICKUP_READY" ||
    legacyStatus === "packed" ||
    order.pickupReadyAt
  ) {
    return 2;
  }

  return 1;
};

const DEFAULT_CITY_SPEED_KMPH = 24;

const parseLatLng = (loc) => {
  if (!loc) return null;
  if (typeof loc.lat === "number" && typeof loc.lng === "number" && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
    return { lat: loc.lat, lng: loc.lng };
  }
  if (typeof loc.latitude === "number" && typeof loc.longitude === "number" && Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)) {
    return { lat: loc.latitude, lng: loc.longitude };
  }
  if (Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
    const [lng, lat] = loc.coordinates;
    if (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }
  return null;
};

const hasValidLatLng = (location) => !!parseLatLng(location);

const toRadians = (value) => (value * Math.PI) / 180;

const distanceMeters = (fromLoc, toLoc) => {
  const from = parseLatLng(fromLoc);
  const to = parseLatLng(toLoc);
  if (!from || !to) return null;
  const r = 6371000;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatArrivalTime = (arrivalMs) =>
  new Date(arrivalMs).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

const formatArrivingIn = (minutes) => {
  if (!Number.isFinite(minutes) || minutes < 0) return "Soon";
  const rounded = Math.max(1, Math.round(minutes));
  return `${rounded} min${rounded === 1 ? "" : "s"}`;
};

const formatDistance = (meters) => {
  if (!Number.isFinite(meters) || meters <= 0) return "—";
  if (meters < 1000) {
    return `${Math.max(50, Math.round(meters / 10) * 10)} m`;
  }
  return `${(meters / 1000).toFixed(meters >= 10000 ? 1 : 2)} km`;
};

const estimateMinutesFromDistance = (meters) => {
  if (!Number.isFinite(meters) || meters <= 0) return null;
  return (meters * 60) / (DEFAULT_CITY_SPEED_KMPH * 1000);
};

const OrderDetails = () => {
  const { orderId } = useParams();
  const { user } = useAuth();
  const [accepting, setAccepting] = useState(false);
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1); // Internal rider flow: 1 pickup, 2 at store, 3 delivery, 4 delivered
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const [isSlideComplete, setIsSlideComplete] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [showDropOtpInput, setShowDropOtpInput] = useState(false);
  const [pickupProofSubmitted, setPickupProofSubmitted] = useState(false);
  const [routeStats, setRouteStats] = useState(null);
  const [clockTick, setClockTick] = useState(Date.now());
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelOtpFlow, setIsCancelOtpFlow] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [isProcessingStep, setIsProcessingStep] = useState(false);

  const isReturn = order?.returnStatus && order.returnStatus !== "none";
  const isShiprocket = order?.isOutOfZone || order?.deliveryType === "SHIPROCKET";

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const response = await deliveryApi.getOrderDetails(orderId);
        const ord = extractOrderDoc(response.data.result);
        setOrder(ord);

        setStep(getPersistedRiderStep(ord));
      } catch (error) {
        toast.error("Failed to fetch order details");
        navigate("/delivery/dashboard");
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId, navigate]);

  useEffect(() => {
    const iv = setInterval(() => setClockTick(Date.now()), 30000);
    return () => clearInterval(iv);
  }, []);

  // Listen for order:status:update — immediately hide map when delivered
  useEffect(() => {
    if (!orderId) return undefined;
    const getToken = createSocketTokenReader(STORAGE_KEYS.AUTH_DELIVERY);
    getOrderSocket(getToken);
    joinOrderRoom(orderId, getToken);

    const off = onOrderStatusUpdate(getToken, (payload) => {
      const ws = String(payload?.workflowStatus || "").toUpperCase();
      if (ws === "DELIVERED") {
        setStep(4);
        setOrder((prev) => {
          const base = extractOrderDoc(prev);
          return base ? { ...base, status: "delivered", workflowStatus: "DELIVERED" } : base;
        });
      } else if (ws === "RESCHEDULED") {
        toast.error("Customer rescheduled this order. Please return the items to the seller.", {
          duration: 10000,
        });
        setOrder((prev) => {
          const base = extractOrderDoc(prev);
          return base ? { ...base, status: "rescheduled", workflowStatus: "RESCHEDULED" } : base;
        });
        navigate("/delivery/dashboard");
      }
    });

    return () => {
      off();
      leaveOrderRoom(orderId, getToken);
    };
  }, [orderId]);

  const steps = useMemo(() => {

    if (isReturn) {
      return [
        {
          id: 1,
          label: "Task Accepted",
          action: "NAVIGATE TO CUSTOMER",
          color: "bg-brand-500",
          bg: "bg-brand-50",
          text: "text-brand-600",
        },
        {
          id: 2,
          label: "At Customer",
          action: "UPLOAD PROOF & OTP",
          color: "bg-orange-500",
          bg: "bg-orange-50",
          text: "text-orange-600",
        },
        {
          id: 3,
          label: "In Transit",
          action: "NAVIGATE TO SELLER",
          color: "bg-purple-600",
          bg: "bg-purple-50",
          text: "text-purple-600",
        },
        {
          id: 4,
          label: "At Seller",
          action: "SELLER OTP VERIFY",
          color: "bg-green-600",
          bg: "bg-green-50",
          text: "text-green-600",
        },
        {
          id: 5,
          label: "Completed",
          action: "DONE",
          color: "bg-brand-700",
          bg: "bg-brand-50",
          text: "text-brand-700",
        },
      ];
    }

    return [
      {
        id: 1,
        label: "Navigate to Store",
        action: "ARRIVED AT STORE",
        color: "bg-black ",
        bg: "bg-brand-50",
        text: "text-brand-600",
      },
      {
        id: 2,
        label: "At Store",
        action: "PICKED UP ORDER",
        color: "bg-orange-500",
        bg: "bg-orange-50",
        text: "text-orange-600",
      },
      {
        id: 3,
        label: "Start Delivery",
        action: "START DELIVERY",
        color: "bg-black ",
        bg: "bg-brand-50",
        text: "text-brand-600",
      },
      {
        id: 4,
        label: "Delivering",
        action: "DELIVERED",
        color: "bg-brand-700",
        bg: "bg-brand-50",
        text: "text-brand-700",
      },
    ];
  }, [order?.returnStatus]);

  // For return flow: 5 steps map to 3 public stages
  // Steps 1-2 = Stage 1 (Return Assigned)
  // Steps 3-4 = Stage 2 (Out for Pickup)
  // Step 5    = Stage 3 (Return Received)
  const publicStatusStage = isReturn
    ? step >= 5 ? 3 : step >= 3 ? 2 : 1
    : getPublicStatusStage(step);
  const cachedRiderLocation = getCachedDeliveryPartnerLocation(30 * 60 * 1000);
  const destinationLocation = parseLatLng(
    order?.address?.location ||
    order?.addressSnapshot?.location ||
    order?.shippingAddress?.location ||
    order?.deliveryAddress?.location
  );

  const summary = useMemo(() => {
    if (!order) {
      return {
        arrivalTimeText: "--",
        arrivingInText: "--",
        totalDistanceText: "—",
      };
    }

    const destLoc = parseLatLng(
      order?.address?.location ||
      order?.addressSnapshot?.location ||
      order?.shippingAddress?.location ||
      order?.deliveryAddress?.location
    );
    const selLoc = parseLatLng(order?.seller?.location);
    const isSellerReq = order?.isSellerRequest || !!order?.requestNumber || order?.orderId?.startsWith("REQ-");

    const recordedDistanceKm =
      order?.distanceSnapshot?.distanceKmRounded ??
      order?.distanceSnapshot?.distanceKmActual ??
      order?.paymentBreakdown?.distanceKmRounded ??
      order?.paymentBreakdown?.distanceKmActual ??
      order?.distanceKm ??
      null;

    const baseDistanceMeters =
      (recordedDistanceKm != null ? recordedDistanceKm * 1000 : null) ||
      distanceMeters(selLoc, destLoc);

    if (publicStatusStage === 3) {
      const formattedRecordedDistance =
        recordedDistanceKm != null
          ? `${recordedDistanceKm} km`
          : baseDistanceMeters != null
          ? formatDistance(baseDistanceMeters)
          : "—";

      return {
        arrivalTimeText: "Arrived",
        arrivingInText: isReturn ? "Return Complete" : "Delivered",
        totalDistanceText: formattedRecordedDistance,
      };
    }

    const routeDistanceMeters = Number(
      routeStats?.routeDistanceMeters ?? routeStats?.distanceMeters,
    );
    const routeDurationSeconds = Number(routeStats?.routeDurationSeconds);
    const riderLocation = routeStats?.rider || cachedRiderLocation;

    const targetLocation = isSellerReq
      ? (destLoc || selLoc)
      : isReturn
      ? (step <= 2 ? destLoc : selLoc)
      : (step <= 2 ? selLoc : destLoc);

    let minutes = null;
    if (Number.isFinite(routeDurationSeconds) && routeDurationSeconds > 0) {
      minutes = routeDurationSeconds / 60;
    } else {
      minutes =
        estimateMinutesFromDistance(routeDistanceMeters) ??
        estimateMinutesFromDistance(distanceMeters(riderLocation, targetLocation)) ??
        estimateMinutesFromDistance(baseDistanceMeters);
    }

    if (!Number.isFinite(minutes) || minutes <= 0) {
      minutes = isReturn ? (step <= 2 ? 10 : 8) : step <= 2 ? 10 : 8;
    }

    const arrivalMs = clockTick + minutes * 60 * 1000;
    const totalDistanceMeters =
      routeDistanceMeters ||
      distanceMeters(riderLocation, targetLocation) ||
      baseDistanceMeters;

    return {
      arrivalTimeText: formatArrivalTime(arrivalMs),
      arrivingInText: formatArrivingIn(minutes),
      totalDistanceText: formatDistance(totalDistanceMeters),
    };
  }, [
    cachedRiderLocation,
    clockTick,
    isReturn,
    order,
    publicStatusStage,
    routeStats,
    step,
  ]);

  const totalBill =
    order?.pricing?.total ??
    order?.pricing?.grandTotal ??
    order?.totalAmount ??
    order?.grandTotal ??
    order?.pricingSummary?.totalAmount ??
    order?.pricingSummary?.total ??
    order?.paymentBreakdown?.grandTotal ??
    order?.paymentBreakdown?.total ??
    order?.total ??
    order?.amount ??
    0;

  const walletAmountUsed =
    order?.pricing?.walletAmount ??
    order?.paymentBreakdown?.walletAmount ??
    order?.pricingSummary?.walletAmount ??
    order?.walletAmount ??
    0;

  const collectCashAmount = Math.max(0, totalBill - walletAmountUsed);

  const isSellerRequest = order?.isSellerRequest || !!order?.requestNumber || order?.orderId?.startsWith("REQ-");

  const customerName =
    order?.customerName ||
    order?.address?.name ||
    order?.address?.fullName ||
    order?.addressSnapshot?.name ||
    order?.addressSnapshot?.fullName ||
    (typeof order?.customer === "object" ? (order?.customer?.name || order?.customer?.fullName) : null) ||
    order?.customerEmail ||
    (typeof order?.customer === "object" ? order?.customer?.email : null) ||
    (isSellerRequest ? (order?.seller?.shopName || order?.seller?.name || "Seller Store") : "Customer");

  const customerPhone =
    order?.customerPhone ||
    order?.address?.phone ||
    order?.addressSnapshot?.phone ||
    (typeof order?.customer === "object" ? order?.customer?.phone : null) ||
    order?.seller?.phone ||
    "";

  const formatAddress = (addr) => {
    if (!addr) return null;
    if (typeof addr === "string" && addr.trim()) return addr.trim();
    if (typeof addr === "object") {
      if (addr.address && typeof addr.address === "string" && addr.address.trim()) {
        const base = addr.address.trim();
        const extraParts = [addr.landmark, addr.city, addr.state, addr.pincode].filter(Boolean);
        const extra = extraParts.join(", ");
        if (extra && !base.toLowerCase().includes((addr.city || "___").toLowerCase())) {
          return `${base}, ${extra}`;
        }
        return base;
      }
      if (addr.completeAddress && typeof addr.completeAddress === "string" && addr.completeAddress.trim()) return addr.completeAddress.trim();
      if (addr.fullAddress && typeof addr.fullAddress === "string" && addr.fullAddress.trim()) return addr.fullAddress.trim();
      if (addr.formattedAddress && typeof addr.formattedAddress === "string" && addr.formattedAddress.trim()) return addr.formattedAddress.trim();
      if (addr.addressLine1 && typeof addr.addressLine1 === "string" && addr.addressLine1.trim()) {
        const line2 = addr.addressLine2 || addr.street || addr.landmark || "";
        const cityState = [addr.city, addr.state, addr.pincode].filter(Boolean).join(", ");
        return [addr.addressLine1, line2, cityState].filter(Boolean).join(", ");
      }
      if (addr.street && typeof addr.street === "string" && addr.street.trim()) {
        const cityState = [addr.city, addr.state, addr.pincode].filter(Boolean).join(", ");
        return [addr.street, addr.landmark, cityState].filter(Boolean).join(", ");
      }
      const parts = [
        addr.houseNo || addr.flatNo || addr.building,
        addr.street || addr.area || addr.locality,
        addr.landmark,
        addr.city,
        addr.state,
        addr.pincode,
      ].filter(Boolean);
      if (parts.length > 0) return parts.join(", ");
    }
    return null;
  };

  const customerAddressText =
    formatAddress(order?.address) ||
    formatAddress(order?.addressSnapshot) ||
    formatAddress(order?.shippingAddress) ||
    formatAddress(order?.deliveryAddress) ||
    (typeof order?.customer === "object" ? formatAddress(order?.customer?.address) : null) ||
    (isSellerRequest ? formatAddress(order?.seller) : null) ||
    "Address not available";

  const getCityOrLocationText = (addr) => {
    if (!addr || typeof addr !== "object") return "";
    const parts = [addr.landmark, addr.city, addr.state, addr.pincode].filter(Boolean);
    return parts.join(", ");
  };

  const customerCityText =
    getCityOrLocationText(order?.address) ||
    getCityOrLocationText(order?.addressSnapshot) ||
    getCityOrLocationText(order?.shippingAddress) ||
    order?.seller?.city ||
    "";

  const isCodPayment =
    order?.payment?.method?.toLowerCase() === "cash" ||
    order?.payment?.method?.toLowerCase() === "cod" ||
    order?.paymentMode?.toLowerCase() === "cod" ||
    order?.paymentMode?.toLowerCase() === "cash";

  const isPaid =
    order?.paymentStatus === "PAID" ||
    order?.paymentStatus === "CAPTURED" ||
    order?.paymentStatus === "SUCCESS" ||
    order?.paymentStatus === "COMPLETED" ||
    order?.payment?.status?.toLowerCase() === "completed" ||
    order?.payment?.status?.toLowerCase() === "paid" ||
    order?.financeFlags?.onlinePaymentCaptured;

  const paymentBadgeText = isPaid
    ? "PAID"
    : isCodPayment
    ? "COD"
    : (order?.payment?.method || order?.paymentMode || order?.paymentStatus || "PENDING").toUpperCase();

  const recordedDistanceKm =
    order?.distanceSnapshot?.distanceKmRounded ??
    order?.distanceSnapshot?.distanceKmActual ??
    order?.paymentBreakdown?.distanceKmRounded ??
    order?.paymentBreakdown?.distanceKmActual ??
    order?.distanceKm ??
    null;

  const distanceText =
    recordedDistanceKm != null
      ? `${recordedDistanceKm} km`
      : summary?.totalDistanceText && summary.totalDistanceText !== "—"
      ? summary.totalDistanceText
      : "";

  const handleNextStep = async () => {
    if (isProcessingStep) return;
    const currentStep = steps[step - 1];

    try {
      setIsProcessingStep(true);

      // Return pickup flow: slide button only advances UI steps (1→2, 3→4)
      // OTP flows handle actual status transitions
      if (order?.returnStatus && order.returnStatus !== "none") {
        if (step === 1) {
          // Accepted → Arrived at Customer: just advance UI to show proof upload
          setStep(2);
          setIsSlideComplete(false);
          setDragX(0);
          window.scrollTo({ top: 0, behavior: "smooth" });
          toast.success("Mark: Arrived at customer. Upload proof to continue.");
          return;
        } else if (step === 3) {
          // In transit → Arrived at Seller: advance UI to show seller OTP
          setStep(4);
          setIsSlideComplete(false);
          setDragX(0);
          window.scrollTo({ top: 0, behavior: "smooth" });
          toast.success("Mark: Arrived at seller. Request OTP to complete.");
          return;
        } else {
          // Steps 2 and 4 are handled by OTP flows, not the slide button
          return;
        }
      } else {
        // Fast non-blocking location resolution (max 1.2s timeout, uses cached rider coords if available)
        const location = await getQuickDeliveryPosition({ timeoutMs: 1200 });

        if (step === 1) {
          const res = await deliveryApi.markArrivedAtStore(order.orderId, {
            lat: location.lat,
            lng: location.lng,
          });
          const updated = extractOrderDoc(res.data.result);
          setOrder((prev) => ({ ...(extractOrderDoc(prev) || {}), ...updated }));
          setStep(2);
          toast.success(`${currentStep.action} Confirmed!`);
        } else if (step === 2) {
          const res = await deliveryApi.confirmPickup(order.orderId, {
            lat: location.lat,
            lng: location.lng,
          });
          const updated = extractOrderDoc(res.data.result);
          setOrder((prev) => ({ ...(extractOrderDoc(prev) || {}), ...updated }));
          setStep(3);
          toast.success(`${currentStep.action} Confirmed!`);
        } else if (step === 3) {
          setStep(4);
          toast.success(`${currentStep.action} Confirmed!`);
        } else {
          navigate(`/delivery/confirm-delivery/${order.orderId}`);
        }

        setIsSlideComplete(false);
        setDragX(0);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (error) {
      console.error("Failed to update status", error);
      const message = error?.response?.data?.message || error?.message || "Failed to update status";
      toast.error(message);
      setIsSlideComplete(false);
      setDragX(0);
    } finally {
      setIsProcessingStep(false);
    }
  };

  const handleNavigate = () => {
    const sellerCoords = order?.seller?.location?.coordinates;
    const sellerLocation =
      Array.isArray(sellerCoords) && sellerCoords.length >= 2
        ? { lat: sellerCoords[1], lng: sellerCoords[0] }
        : parseLatLng(order?.seller?.location);
    const customerLocation = parseLatLng(
      order?.address?.location ||
      order?.addressSnapshot?.location ||
      order?.shippingAddress?.location ||
      order?.deliveryAddress?.location
    );

    const dest = isReturn
      ? step <= 1
        ? customerLocation
        : sellerLocation
      : step >= 3
        ? customerLocation
        : sellerLocation;

    if (
      dest &&
      typeof dest.lat === "number" &&
      typeof dest.lng === "number" &&
      Number.isFinite(dest.lat) &&
      Number.isFinite(dest.lng)
    ) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`,
        "_blank"
      );
      return;
    }

    const addrQuery = isReturn
      ? step <= 1 ? customerAddressText : (order?.seller?.address || order?.seller?.shopName)
      : step >= 3 ? customerAddressText : (order?.seller?.address || order?.seller?.shopName);

    if (addrQuery && addrQuery !== "Address not available") {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addrQuery)}`,
        "_blank"
      );
      return;
    }

    window.open("https://maps.google.com", "_blank");
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  const handleOtpGenerated = (data) => {
    console.log("OTP generated successfully:", data);
    setShowOtpInput(true);
    toast.success("OTP sent to customer!");
  };

  const handleOtpGenerationError = (error) => {
    console.error("Failed to generate OTP:", error);
  };

  const handleOtpValidationSuccess = (data) => {
    const rawResult = data?.result || data?.data?.result;
    const updatedOrder = extractOrderDoc(rawResult?.order || rawResult || data);

    setShowOtpInput(false);
    setPickupProofSubmitted(false);
    setIsSlideComplete(false);
    setDragX(0);

    if (isReturn) {
      // Return pickup OTP → navigate to seller for drop-off
      setStep(3);
      if (updatedOrder) setOrder((prev) => ({ ...(extractOrderDoc(prev) || {}), ...updatedOrder }));
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast.success("✅ Pickup verified! Navigate to seller for drop-off.");
    } else {
      // Standard delivery OTP → order is delivered, hide map immediately
      setStep(4);
      setOrder((prev) => {
        const base = extractOrderDoc(updatedOrder) || extractOrderDoc(prev) || {};
        return { ...base, status: "delivered", workflowStatus: "DELIVERED" };
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast.success("✅ Order delivered successfully!");
    }
  };

  const handleOtpValidationError = (error) => {
    console.error("OTP validation error:", error);
  };

  const handleRequestCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error("Please enter a reason for cancellation");
      return;
    }
    try {
      setCancelLoading(true);
      await deliveryApi.requestCancelOtp(orderId, { reason: cancelReason });
      setShowCancelModal(false);
      setIsCancelOtpFlow(true);
      setShowOtpInput(true);
      toast.success("Cancellation OTP sent to customer");
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to request cancel OTP");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleAcceptReturn = async () => {
    try {
      setAccepting(true);
      const res = await deliveryApi.acceptReturnPickup(order.orderId);
      const updated = res.data.result;
      setOrder(updated);
      toast.success("Return pickup task accepted!");
      setStep(1);
    } catch (error) {
      console.error("Failed to accept return pickup", error);
      toast.error(error.response?.data?.message || "Failed to accept task");
    } finally {
      setAccepting(false);
    }
  };

  // Check if current rider is assigned to this order / return
  const isAssignedRider = useMemo(() => {
    if (!order || !user) return false;
    if (isReturn) {
      const returnRiderId = order.returnDeliveryBoy?._id || order.returnDeliveryBoy;
      return String(returnRiderId) === String(user._id);
    }
    const deliveryBoyId = order.deliveryBoy?._id || order.deliveryBoy;
    return String(deliveryBoyId) === String(user._id);
  }, [order, user, isReturn]);

  const isReturnWaitAccept = useMemo(() => {
    if (!order) return false;
    const isReturn = order.returnStatus && order.returnStatus !== "none";
    return isReturn && !order.returnDeliveryBoy;
  }, [order]);

  // Determine current phase for map
  // Return: steps 1-2 = navigate to customer (pickup), steps 3-4 = navigate to seller (delivery)
  const currentPhase = isReturn ? (step <= 2 ? "pickup" : "delivery") : step <= 2 ? "pickup" : "delivery";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (!order) return null;

  const orderShortId =
    typeof order.orderId === "string" ? order.orderId.slice(-8) : order.orderId;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-28 font-sans">
      {/* Header */}
      <div className="bg-white/85 backdrop-blur-md sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="mr-2"
          >
            <ChevronDown className="rotate-90 text-slate-800" size={24} />
          </Button>
          <h1 className="text-base font-bold text-slate-800">Order #{orderShortId}</h1>
        </div>
        <div className="flex flex-col items-end">
          <span
            className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide ${publicStatusStage === 1
                ? "bg-brand-100 text-brand-700"
                : publicStatusStage === 2
                  ? "bg-amber-100 text-amber-700"
                  : "bg-brand-100 text-brand-700"
              }`}
          >
            {isReturn ? (
              publicStatusStage === 1 ? "Return Assigned" :
                publicStatusStage === 2 ? "Out for Pickup" :
                  "Return Received"
            ) : (
              publicStatusStage === 1 ? "Confirmed" :
                publicStatusStage === 2 ? "Out for Delivery" :
                  "Delivered"
            )}
          </span>
          {isCodPayment && !isReturn && !isShiprocket && step < 4 && (
            <span className={`mt-1 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-sm animate-pulse bg-orange-600`}>
              COLLECT CASH: ₹{collectCashAmount}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Shiprocket Delivery Notice */}
        {isShiprocket && (
          <Card className="bg-[#FFF8E8] border border-[#F4D98B] p-6 rounded-[24px] text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-[#F6E7BF] flex items-center justify-center text-[#C87400]">
              <Truck size={24} />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-800">Shiprocket Order</h3>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                This order is shipped via Shiprocket. Local delivery partner assignment and workflow tracking are disabled.
              </p>
            </div>
            {order.shipRocketDetails?.trackingNumber && (
              <div className="bg-white rounded-2xl p-3 border border-[#F4D98B] max-w-xs mx-auto">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tracking ID</span>
                <span className="font-black text-slate-800 text-sm">{order.shipRocketDetails.trackingNumber}</span>
              </div>
            )}
          </Card>
        )}

        {/* Acceptance Guard for Returns */}
        <AnimatePresence>
          {isReturnWaitAccept && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="bg-black  rounded-[32px] p-8 text-white shadow-xl relative overflow-hidden mb-6"
            >
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-brand-400/20 rounded-full blur-3xl" />

              <div className="relative z-10 flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                  <Package className="text-white" size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-black mb-1 uppercase tracking-tight text-white">
                    New Return Task
                  </h2>
                  <p className="text-brand-100 text-sm font-medium leading-relaxed">
                    Pick up product from customer and deliver back to seller.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full pt-4">
                  <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                    <p className="text-[10px] uppercase font-bold text-brand-200 mb-1">
                      Earnings
                    </p>
                    <p className="text-xl font-black text-white">
                      ₹{order.returnDeliveryCommission || 0}
                    </p>
                  </div>
                  <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                    <p className="text-[10px] uppercase font-bold text-brand-200 mb-1">
                      Distance
                    </p>
                    <p className="text-xl font-black text-white">
                      {summary.totalDistanceText}
                    </p>
                  </div>
                </div>

                {/* Product Detail List */}
                <div className="w-full space-y-3 pt-2">
                  <p className="text-[10px] uppercase font-bold text-brand-200 text-left px-1">
                    Items to pick up
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar-dark text-left">
                    {(order.returnItems || order.items)?.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 bg-white/10 p-2 rounded-xl border border-white/5">
                        <div className="h-12 w-12 rounded-lg bg-white overflow-hidden flex-shrink-0">
                          <img
                            src={item.image || (item.product?.mainImage) || "/placeholder.png"}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{item.name}</p>
                          <p className="text-[10px] text-brand-200 font-medium">Qty: {item.quantity}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {order.returnReason && (
                    <div className="bg-brand-900/30 rounded-xl p-3 border border-brand-400/20 text-left">
                      <p className="text-[10px] uppercase font-bold text-brand-200 mb-1">Reason for return</p>
                      <p className="text-xs text-white leading-relaxed line-clamp-2">{order.returnReason}</p>
                      {order.returnReasonDetail && (
                        <p className="text-[10px] text-brand-100 italic mt-1 line-clamp-2">"{order.returnReasonDetail}"</p>
                      )}

                      {order.returnImages?.length > 0 && (
                        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                          {order.returnImages.map((img, idx) => (
                            <img key={idx} src={img} alt={`Return Proof ${idx}`} className="w-10 h-10 rounded-lg object-cover border border-white/20 shrink-0" />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="w-full pt-4">
                  <Button
                    loading={accepting}
                    onClick={handleAcceptReturn}
                    className="w-full bg-white text-brand-700 hover:bg-slate-50 h-14 rounded-2xl font-black text-lg shadow-lg border-none"
                  >
                    ACCEPT TASK
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {isReturn && order.returnDeliveryBoy && !isAssignedRider && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-red-50 rounded-2xl p-4 border border-red-100 flex items-center text-red-700 mb-6"
            >
              <AlertTriangle className="mr-3" size={20} />
              <p className="font-bold text-sm">
                This task has been accepted by another partner.
              </p>
            </motion.div>
          )}
        </AnimatePresence>


        {/* Map Section - Hidden when completed or Shiprocket */}
        {!isShiprocket && (isReturn ? step < 5 : step < 4) && isAssignedRider && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl overflow-hidden shadow-lg border border-slate-200/50 bg-white"
          >
            <div className="h-[340px] sm:h-[420px]">
              <DeliveryTrackingMap
                orderId={orderId}
                phase={currentPhase}
                order={order}
                onRouteStatsChange={setRouteStats}
              />
            </div>
          </motion.div>
        )}

        {!isShiprocket && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#FFF8E8] rounded-3xl p-4 shadow-sm border border-[#F4D98B] flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 bg-[#F6E7BF] rounded-xl flex items-center justify-center text-[#C87400]">
                <Navigation size={20} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-[#C85D00] uppercase tracking-wider">
                  Estimated Time
                </p>
                <p className="text-xl font-black text-[#8B3F00] leading-none">
                  {summary.arrivalTimeText}
                </p>
              </div>
            </div>
            <div className="text-right flex flex-col items-end gap-2">
              <div>
                <p className="text-[11px] font-bold text-[#C85D00] uppercase tracking-wider">
                  Arriving in
                </p>
                <p className="text-xl font-black text-[#8B3F00] leading-none">
                  {summary.arrivingInText}
                </p>
              </div>
              <div className="inline-flex items-center rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-bold text-[#C87400] ring-1 ring-[#F4D98B]">
                Total distance: {summary.totalDistanceText}
              </div>
            </div>
          </motion.div>
        )}

        {!isShiprocket && (
          <Card className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center px-2 mb-2 relative">
              <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -z-10 rounded-full" />
              <motion.div
                className="absolute top-1/2 left-0 h-1 bg-brand-500 -z-10 rounded-full"
                initial={{ width: "0%" }}
                animate={{
                  width: `${((publicStatusStage - 1) / (PUBLIC_STATUS_STEPS.length - 1)) * 100}%`,
                }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              />
              {PUBLIC_STATUS_STEPS.map(({ id, label }) => {
                const isStepFinished = id < publicStatusStage || (id === publicStatusStage && (publicStatusStage === 3 || step >= 4 || String(order?.workflowStatus).toUpperCase() === "DELIVERED"));
                return (
                  <motion.div
                    key={id}
                    initial={false}
                    animate={{
                      scale: id === publicStatusStage ? 1.15 : 1,
                      backgroundColor: isStepFinished ? "var(--primary)" : "#ffffff",
                      borderColor: isStepFinished ? "var(--primary)" : "#e5e7eb",
                      color: isStepFinished ? "#ffffff" : "#9ca3af",
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 z-10 shadow-sm"
                    aria-label={label}
                  >
                    {isStepFinished ? <CheckCircle size={16} /> : id}
                  </motion.div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500 font-medium px-1">
              {PUBLIC_STATUS_STEPS.map(({ id, label }) => (
                <span key={id} className="text-center">
                  {label}
                </span>
              ))}
            </div>
          </Card>
        )}

        <AnimatePresence mode="wait">
          {/* Customer pickup card: show at return steps 1-2, standard delivery steps 1-2 */}
          {!isShiprocket && (isReturn ? (step === 1 || step === 2) : step <= 2) && (
            <motion.div
              key="pickup"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-orange-50/50 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="p-2 bg-white rounded-full shadow-sm mr-3">
                      {isReturn ? (
                        <User className="text-orange-600" size={20} />
                      ) : (
                        <Store className="text-orange-600" size={20} />
                      )}
                    </div>
                    <div>
                      <h2 className="font-bold text-gray-800">
                        {isReturn ? "Customer Pickup" : "Pickup Location"}
                      </h2>
                      <p className="text-xs text-orange-600 font-medium">
                        {isReturn ? "Customer Address" : "Store Location"}
                      </p>
                    </div>
                  </div>
                  {(isReturn ? customerPhone : order.seller?.phone) && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() =>
                        (window.location.href = `tel:${isReturn ? customerPhone : order.seller?.phone}`)
                      }
                    >
                      <Phone size={18} />
                    </Button>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-1">
                    {isReturn
                      ? customerName
                      : order.seller?.shopName || "Seller Store"}
                  </h3>
                  <p className="text-gray-500 text-sm mb-4 leading-relaxed">
                    {isReturn
                      ? customerAddressText
                      : order.seller?.address || "Address not available"}
                  </p>
                  <Button onClick={handleNavigate} className="w-full" variant="outline">
                    <Navigation size={18} className="mr-2" />{" "}
                    {isReturn ? "Navigate to Customer" : "Navigate to Store"}
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* Seller card: return steps 3-4, standard delivery steps 3-4 */}
          {!isShiprocket && (isReturn ? (step === 3 || step === 4) : step >= 3) && step < (isReturn ? 5 : 5) && (
            <motion.div
              key="customer"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <Card className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-brand-50/50 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="p-2 bg-white rounded-full shadow-sm mr-3">
                      {isReturn || isSellerRequest ? (
                        <Store className="text-brand-600" size={20} />
                      ) : (
                        <User className="text-brand-600" size={20} />
                      )}
                    </div>
                    <div>
                      <h2 className="font-bold text-gray-800">
                        {isReturn ? "Return Drop" : isSellerRequest ? "Seller Request Details" : "Customer Details"}
                      </h2>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <p
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            isCodPayment
                              ? "bg-orange-50 text-orange-700 border-orange-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {paymentBadgeText}
                        </p>
                        <p className="text-[10px] text-slate-600 font-bold">Bill: ₹{totalBill}</p>
                        {distanceText && (
                          <span className="text-[10px] text-slate-600 bg-slate-100 font-semibold px-2 py-0.5 rounded-full border border-slate-200">
                            📍 {distanceText}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {(isReturn ? order.seller?.phone : customerPhone) && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        title="Send SMS"
                        onClick={() => {
                          const ph = isReturn ? order.seller?.phone : customerPhone;
                          window.location.href = `sms:${ph}`;
                        }}
                      >
                        <MessageSquare size={18} />
                      </Button>
                    )}
                    {(isReturn ? order.seller?.phone : customerPhone) && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        title="Call"
                        onClick={() =>
                          (window.location.href = `tel:${isReturn ? order.seller?.phone : customerPhone}`)
                        }
                      >
                        <Phone size={18} />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-1">
                    {isReturn || isSellerRequest
                      ? order.seller?.shopName || order.seller?.name || customerName
                      : customerName}
                  </h3>
                  <p className="text-gray-500 text-sm mb-1 leading-relaxed">
                    {customerAddressText}
                  </p>
                  {customerCityText && !isReturn && !customerAddressText.includes(customerCityText) && (
                    <p className="text-gray-500 text-sm mb-2 font-medium">
                      {customerCityText}
                    </p>
                  )}
                  {customerPhone && !isReturn && (
                    <p className="text-xs text-slate-500 mb-4 font-semibold flex items-center gap-1.5">
                      <Phone size={14} className="text-slate-400" /> {customerPhone}
                    </p>
                  )}
                  <Button onClick={handleNavigate} className="w-full bg-black hover:bg-brand-700 text-primary-foreground border-none">
                    <Navigation size={18} className="mr-2" />{" "}
                    {isReturn || isSellerRequest ? "Navigate to Seller" : "Navigate to Customer"}
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <Card className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <motion.div
            className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setItemsExpanded(!itemsExpanded)}
          >
            <div className="flex items-center font-bold text-gray-800">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg mr-3">
                <Package size={20} />
              </div>
              <div>
                <span>Order Items</span>
                <span className="ml-2 text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {(isReturn ? order.returnItems : (order.items || order.lineItems || order.paymentBreakdown?.lineItems))?.length || 0} items
                </span>
              </div>
            </div>
            <motion.div animate={{ rotate: itemsExpanded ? 180 : 0 }} transition={{ duration: 0.3 }}>
              <ChevronDown size={20} className="text-gray-400" />
            </motion.div>
          </motion.div>

          <AnimatePresence>
            {itemsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="p-4 border-t border-gray-100 bg-gray-50/50 space-y-3">
                  {(isReturn ? order.returnItems : (order.items || order.lineItems || order.paymentBreakdown?.lineItems))?.map((item, i) => {
                    const itemName = item.name || item.productName || item.product?.name || "Item";
                    const itemQty = item.quantity || 1;
                    const itemUnitPrice = item.price || item.unitPrice || item.product?.price || 0;
                    return (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <div className="flex items-center">
                          <span className="font-bold text-gray-500 mr-3 text-xs w-6 bg-white border border-gray-200 text-center rounded py-0.5">
                            x{itemQty}
                          </span>
                          <span className="text-gray-800 font-medium">{itemName}</span>
                        </div>
                        <span className="font-bold text-gray-600">₹{itemUnitPrice * itemQty}</span>
                      </div>
                    );
                  })}
                  <div className="pt-3 mt-2 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-gray-500 text-sm font-semibold">Total Bill</span>
                    <span className="text-lg font-bold text-gray-900">₹{totalBill}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        <motion.div
          className="bg-yellow-50 rounded-2xl p-4 border border-yellow-200 flex items-start shadow-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <AlertTriangle className="text-yellow-600 mr-3 mt-0.5 flex-shrink-0" size={18} />
          <p className="text-sm text-yellow-800 leading-relaxed">
            <strong>Note:</strong> Handle eggs with care. Call customer if location is hard to find.
          </p>
        </motion.div>

        {/* Return Step 2: Upload proof then request customer pickup OTP */}
        {isReturn && step === 2 && !showOtpInput && isAssignedRider && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            {!pickupProofSubmitted ? (
              <ReturnPickupProofUpload
                orderId={orderId}
                onSubmitted={() => setPickupProofSubmitted(true)}
              />
            ) : (
              <Card className="p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex items-center mb-4 text-gray-800">
                  <ShieldCheck className="mr-2 text-primary" size={24} />
                  <h3 className="font-bold text-lg">Request Pickup OTP</h3>
                </div>
                <p className="text-gray-500 text-sm mb-4">
                  Proof uploaded ✅. Slide to send OTP to customer.
                </p>
                <DeliverySlideButton
                  orderId={orderId}
                  onSuccess={handleOtpGenerated}
                  onError={handleOtpGenerationError}
                  isReturn={true}
                  bgColor="bg-orange-500"
                  bgColorLight="bg-orange-50"
                  label="SLIDE TO SEND CUSTOMER OTP"
                />
              </Card>
            )}
          </motion.div>
        )}

        {/* Reschedule Option for Delivery */}
        {!isReturn && step === 3 && !showOtpInput && !String(orderId).toUpperCase().startsWith("REQ-") && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mb-4">
            <Card className="p-4 rounded-3xl shadow-sm border border-brand-100 bg-brand-50/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="bg-white p-2 rounded-full shadow-sm mr-3">
                    <Calendar size={20} className="text-brand-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm">Customer unavailable?</h4>
                    <p className="text-xs text-gray-500">Reschedule this delivery for later</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(`/delivery/reschedule/${orderId}`)}
                  className="bg-white border-brand-200 text-brand-700 hover:bg-brand-50 rounded-xl"
                >
                  Reschedule
                </Button>
              </div>
              {/* Cancel Delivery Option */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-brand-100">
                <div className="flex items-center">
                  <div className="bg-white p-2 rounded-full shadow-sm mr-3">
                    <XCircle size={20} className="text-red-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm">Need to cancel?</h4>
                    <p className="text-xs text-gray-500">Cancel this delivery</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowCancelModal(true)}
                  className="bg-white border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 rounded-xl"
                >
                  Cancel
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Cancel Reason Modal */}
        {showCancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95 duration-200">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Cancel Delivery</h3>
              <p className="text-sm text-gray-500 mb-4">Please provide a reason for cancelling this delivery. An OTP will be sent to the customer to verify this action.</p>
              
              <textarea
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[100px] mb-4"
                placeholder="Enter cancellation reason..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
              
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1 rounded-xl"
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancelReason("");
                  }}
                >
                  Back
                </Button>
                <Button 
                  className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleRequestCancel}
                  disabled={cancelLoading}
                >
                  {cancelLoading ? <Loader2 className="animate-spin" size={16} /> : "Verify via OTP"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Normal delivery Step 3: generate OTP for customer */}
        {!isReturn && step === 3 && !showOtpInput && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center mb-4 text-gray-800">
                <ShieldCheck className="mr-2 text-primary" size={24} />
                <h3 className="font-bold text-lg">Generate Delivery OTP</h3>
              </div>
              <p className="text-gray-500 text-sm mb-4">
                Slide to generate OTP for the customer.
              </p>
              <DeliverySlideButton
                orderId={orderId}
                onSuccess={handleOtpGenerated}
                onError={handleOtpGenerationError}
                isReturn={false}
              />
            </Card>
          </motion.div>
        )}

        {/* Return Step 4: arrived at seller — request seller drop OTP */}
        {isReturn && step === 4 && !showDropOtpInput && isAssignedRider && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="p-6 rounded-3xl shadow-sm border border-green-100">
              <div className="flex items-center mb-4 text-gray-800">
                <ShieldCheck className="mr-2 text-green-600" size={24} />
                <h3 className="font-bold text-lg">Request Seller OTP</h3>
              </div>
              <p className="text-gray-500 text-sm mb-4">
                Slide to send OTP to seller (via app + SMS). Seller will share it with you.
              </p>
              <DeliverySlideButton
                orderId={orderId}
                isReturn={false}
                isReturnDrop={true}
                bgColor="bg-green-600"
                bgColorLight="bg-green-50"
                label="SLIDE TO SEND SELLER OTP"
                onSuccess={() => {
                  setShowDropOtpInput(true);
                  toast.success("OTP sent to seller!");
                }}
                onError={(err) => toast.error(err?.message || "Failed to send seller OTP")}
              />
            </Card>
          </motion.div>
        )}

        {/* Pickup OTP input */}
        {showOtpInput && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="p-6 rounded-3xl shadow-sm border border-slate-100">
              <OtpInput
                orderId={orderId}
                isReturn={isReturn}
                isReturnDrop={false}
                isCancel={isCancelOtpFlow}
                cancelReason={cancelReason}
                onSuccess={(data) => {
                  if (isCancelOtpFlow) {
                    toast.success("Order cancelled successfully");
                    navigate("/delivery/dashboard");
                  } else {
                    handleOtpValidationSuccess(data);
                  }
                }}
                onError={handleOtpValidationError}
                onCancel={() => {
                  setShowOtpInput(false);
                  setIsCancelOtpFlow(false);
                }}
              />
            </Card>
          </motion.div>
        )}

        {/* Seller drop OTP input */}
        {isReturn && showDropOtpInput && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="p-6 rounded-3xl shadow-sm border border-green-100">
              <OtpInput
                orderId={orderId}
                isReturn={false}
                isReturnDrop={true}
                onSuccess={(data) => {
                  const updatedOrder = data?.result || data?.data?.result;
                  if (updatedOrder) setOrder(updatedOrder);
                  setStep(5);
                  toast.success("✅ Return complete! Commission credited to your wallet.");
                  setTimeout(() => navigate("/delivery/dashboard"), 1800);
                }}
                onError={handleOtpValidationError}
                onCancel={() => setShowDropOtpInput(false)}
              />
            </Card>
          </motion.div>
        )}

      </div>

      {/* Slide button: for returns shown at steps 1 and 3 (navigation steps); for standard shown at steps 1-2 */}
      {!isShiprocket && ((isReturn && (step === 1 || step === 3) && isAssignedRider) || (!isReturn && step <= 2)) && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
          <div className="max-w-2xl mx-auto p-4">
            <div className="relative h-16 bg-slate-100 rounded-full overflow-hidden select-none">
              <motion.div
                className={`absolute inset-0 flex items-center justify-center text-slate-400 font-bold text-lg pointer-events-none transition-opacity duration-300 ${dragX > 50 ? "opacity-0" : "opacity-100"
                  }`}
                animate={{ x: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                Slide to {
                  isReturn
                    ? step === 1 ? "ARRIVED AT CUSTOMER"
                      : step === 3 ? "ARRIVED AT SELLER"
                        : steps[step - 1]?.action
                    : steps[step - 1]?.action
                } <ChevronRight className="ml-1" />
              </motion.div>

              <motion.div
                className={`absolute inset-y-0 left-0 ${steps[step - 1].bg} opacity-50`}
                style={{ width: dragX + 60 }}
              />

              <motion.div
                className={`absolute top-1 bottom-1 left-1 w-14 rounded-full flex items-center justify-center shadow-md ${
                  isProcessingStep ? "cursor-wait opacity-90" : "cursor-grab active:cursor-grabbing"
                } z-20 ${steps[step - 1].color || "bg-primary"}`}
                drag={isProcessingStep ? false : "x"}
                dragConstraints={{ left: 0, right: 280 }}
                dragElastic={0.05}
                dragMomentum={false}
                onDrag={(event, info) => {
                  if (!isProcessingStep) {
                    setDragX(info.point.x);
                  }
                }}
                onDragEnd={(event, info) => {
                  if (isProcessingStep) return;
                  if (info.offset.x > 140) {
                    setIsSlideComplete(true);
                    handleNextStep();
                  } else {
                    setDragX(0);
                  }
                }}
                animate={{ x: isSlideComplete ? 280 : 0 }}
                whileHover={{ scale: isProcessingStep ? 1 : 1.05 }}
                whileTap={{ scale: isProcessingStep ? 1 : 0.95 }}
              >
                {isProcessingStep ? (
                  <Loader2 className="text-white animate-spin" size={22} />
                ) : (
                  <ChevronRight className="text-white" size={24} />
                )}
              </motion.div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetails;
