import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import { sellerApi } from '../services/sellerApi';
import { toast } from 'sonner';
import { HiOutlineArrowLeft } from 'react-icons/hi2';
import LiveTrackingMap from '../../customer/components/order/LiveTrackingMap';
import DeliveryOtpDisplay from '../../customer/components/DeliveryOtpDisplay';
import { STORAGE_KEYS } from '@core/utils/storageKeys';
import { subscribeToOrderLocation } from '@/core/services/trackingClient';
import { MessageSquare, Phone } from 'lucide-react';
import { motion } from 'framer-motion';
const RequestedOrderDetails = () => {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const [requestDetails, setRequestDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [liveLocation, setLiveLocation] = useState(null);
  const [trackingRoutePhase, setTrackingRoutePhase] = useState("pickup");

  useEffect(() => {
    fetchRequestDetails();
  }, [requestId]);

  const fetchRequestDetails = async () => {
    try {
      setIsLoading(true);
      const res = await sellerApi.getSellerRequestById(requestId);
      if (res.data.success) {
        const data = res.data.data;
        const workflowStatus = String(data.deliveryWorkflowStatus || data.workflowStatus || "").toUpperCase();
        data.workflowStatus = workflowStatus; // Map it so UI works seamlessly
        
        setRequestDetails(data);
        
        const isDeliveryPhase = workflowStatus === "OUT_FOR_DELIVERY" || workflowStatus === "DELIVERED";
        setTrackingRoutePhase(isDeliveryPhase ? "delivery" : "pickup");
      } else {
        toast.error("Failed to load request details");
        navigate('/seller/requested-orders');
      }
    } catch (error) {
      console.error("Error fetching request details:", error);
      toast.error("An error occurred");
      navigate('/seller/requested-orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!requestDetails) return;
    
    // Using the same trackingId logic as customer tracking (usually the canonical order ID or request number)
    const trackingId = requestDetails.requestNumber;
    
    // Subscribe to live location of the delivery boy
    const offLocation = subscribeToOrderLocation(trackingId, (loc) => {
      setLiveLocation(loc);
    });

    return () => {
      offLocation && offLocation();
    };
  }, [requestDetails]);

  const formatPrice = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="warning">Pending Approval</Badge>;
      case 'APPROVED':
        return <Badge variant="success">Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">Rejected</Badge>;
      case 'COMPLETED':
        return <Badge variant="default">Completed</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  if (isLoading) {
    return <div style={{ padding: "40px", textAlign: "center" }}>Loading request details...</div>;
  }

  if (!requestDetails) return null;

  const showTracking = requestDetails.workflowStatus === 'DELIVERY_ASSIGNED' || 
                       requestDetails.workflowStatus === 'PICKUP_READY' ||
                       requestDetails.workflowStatus === 'OUT_FOR_DELIVERY';

  return (
    <div style={{ padding: "24px", backgroundColor: "#f5f5f5", minHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
        <button
          onClick={() => navigate("/seller/requested-orders")}
          style={{
            background: "white",
            border: "1px solid #ddd",
            padding: "8px",
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <HiOutlineArrowLeft size={20} color="#333" />
        </button>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#333", margin: "0 0 4px" }}>
            Request #{requestDetails.requestNumber}
          </h1>
          <p style={{ fontSize: "14px", color: "#666", margin: "0" }}>
            Placed on {new Date(requestDetails.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Left Column: Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <Card padding="lg">
            <h3 style={{ margin: "0 0 16px", fontSize: "18px" }}>Summary</h3>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ color: "#666" }}>Status</span>
              <span>{getStatusBadge(requestDetails.status)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ color: "#666" }}>Workflow Status</span>
              <span style={{ fontWeight: "500" }}>{requestDetails.workflowStatus || 'N/A'}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ color: "#666" }}>Total Amount</span>
              <span style={{ fontWeight: "700" }}>{formatPrice(requestDetails.totalAmount)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ color: "#666" }}>Payment Type</span>
              <span>{requestDetails.paymentType}</span>
            </div>
          </Card>

          <Card padding="lg">
            <h3 style={{ margin: "0 0 16px", fontSize: "18px" }}>Items ({requestDetails.items?.length || 0})</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {requestDetails.items?.map((item, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", paddingBottom: "12px", borderBottom: idx < requestDetails.items.length - 1 ? "1px solid #eee" : "none" }}>
                  <div>
                    <div style={{ fontWeight: "500", color: "#333" }}>{item.productName || item.productId}</div>
                    <div style={{ fontSize: "13px", color: "#666" }}>Qty: {item.quantity} × {formatPrice(item.pricePerUnit || item.price)}</div>
                  </div>
                  <div style={{ fontWeight: "600" }}>
                    {formatPrice(item.quantity * (item.pricePerUnit || item.price || 0))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column: Tracking */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <Card padding="none" style={{ overflow: "hidden", height: "400px", position: "relative" }}>
            {showTracking ? (
              <LiveTrackingMap
                status={requestDetails.deliveryWorkflowStatus}
                riderName={requestDetails.deliveryBoy?.name || "Delivery Partner"}
                storeLocation={null}
                customerLocation={null} // Map doesn't strictly need it if route isn't rendered or is handled in map component
                liveLocation={liveLocation}
                routePolyline={null}
                trail={[]}
                phase={trackingRoutePhase}
                headerColor="#3B9FD9"
              />
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f9f9f9", color: "#999", flexDirection: "column" }}>
                <span style={{ fontSize: "40px", marginBottom: "16px" }}>🗺️</span>
                <p>Live tracking not available yet.</p>
                <p style={{ fontSize: "13px" }}>Tracking will appear when a delivery boy is assigned.</p>
              </div>
            )}
          </Card>

          {showTracking && (
            <DeliveryOtpDisplay 
              orderId={requestDetails.requestNumber} 
              tokenKey={STORAGE_KEYS.AUTH_SELLER} 
            />
          )}

          {/* Delivery Partner Card */}
          {requestDetails.deliveryBoy && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-50 border border-gray-200 rounded-3xl p-5 shadow-sm text-gray-900"
            >
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="h-14 w-14 rounded-full bg-white overflow-hidden border-2 border-gray-200 shadow-sm">
                    <img
                      src={requestDetails.deliveryBoy?.profileImage || "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&auto=format&fit=crop&q=60"}
                      alt="Rider"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-white text-gray-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-md border border-gray-200">
                    4.8 ★
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Your Courier</p>
                  <h3 className="font-bold text-gray-900 text-lg">{requestDetails.deliveryBoy?.name || "Delivery Partner"}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">On the way to you</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="h-11 w-11 rounded-full bg-white flex items-center justify-center hover:bg-gray-100 transition-colors border border-gray-200 shadow-sm">
                    <MessageSquare size={20} className="text-gray-600" />
                  </button>
                  <button className="h-11 w-11 rounded-full bg-white flex items-center justify-center hover:bg-gray-100 transition-colors border border-gray-200 shadow-sm">
                    <Phone size={20} className="text-gray-600" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestedOrderDetails;
