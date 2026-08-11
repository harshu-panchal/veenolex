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

  // Delivery Assign Modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [deliveryPartners, setDeliveryPartners] = useState([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');

  useEffect(() => {
    fetchRequestDetails();
  }, [requestId]);

  const fetchDrivers = async () => {
    try {
      const res = await sellerApi.getDeliveryPartners();
      const driversList = res.data?.results || res.data?.result || res.data?.data || (Array.isArray(res.data) ? res.data : []);
      setDeliveryPartners(Array.isArray(driversList) ? driversList : []);
    } catch (e) {
      console.error("Failed to load delivery partners:", e);
    }
  };

  const handleOpenAssignModal = () => {
    setSelectedDriverId('');
    setIsAssignModalOpen(true);
    fetchDrivers();
  };

  const handleBroadcastDelivery = async () => {
    try {
      await sellerApi.broadcastRequestDelivery(requestId);
      toast.success("📡 Delivery broadcast sent to nearby delivery partners!");
      setIsAssignModalOpen(false);
      fetchRequestDetails();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to broadcast delivery");
    }
  };

  const handleManualAssignDriver = async (driverId) => {
    if (!driverId) {
      toast.error("Please select a delivery partner");
      return;
    }
    try {
      await sellerApi.assignRequestDeliveryBoy(requestId, driverId);
      toast.success("Delivery partner assigned successfully!");
      setIsAssignModalOpen(false);
      fetchRequestDetails();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to assign delivery partner");
    }
  };

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

      {/* Assign Delivery Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl relative border border-slate-100"
          >
            <button 
              onClick={() => setIsAssignModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 font-bold text-lg"
            >
              ✕
            </button>

            <div className="text-center mb-6">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3 font-black text-xl">
                🚚
              </div>
              <h3 className="text-lg font-black text-slate-900">Assign Delivery Partner</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Request #{requestDetails.requestNumber}
              </p>
            </div>

            <div className="space-y-4">
              {/* Option A: Broadcast */}
              <button
                onClick={handleBroadcastDelivery}
                className="w-full p-4 rounded-2xl border-2 border-primary/20 bg-primary/5 hover:bg-primary/10 text-left transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold shrink-0 shadow-md">
                    📡
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 group-hover:text-primary">Broadcast to All Drivers</h4>
                    <p className="text-[10px] text-slate-500 font-medium">Alert all nearby online drivers instantly</p>
                  </div>
                </div>
              </button>

              {/* Option B: Manual */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shrink-0">
                    👤
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">Select Specific Driver</h4>
                    <p className="text-[10px] text-slate-500 font-medium">Manually pick from active driver list</p>
                  </div>
                </div>

                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">-- Choose Delivery Driver --</option>
                  {(Array.isArray(deliveryPartners) ? deliveryPartners : []).map((driver) => (
                    <option key={driver._id} value={driver._id}>
                      {driver.name} ({driver.phone}) - {driver.isOnline ? "🟢 Online" : "🔴 Offline"}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => handleManualAssignDriver(selectedDriverId)}
                  disabled={!selectedDriverId}
                  className="w-full py-2.5 bg-slate-900 text-white text-xs font-black rounded-xl uppercase tracking-wider disabled:opacity-50 hover:bg-slate-800 transition-all shadow-md"
                >
                  ASSIGN DRIVER
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default RequestedOrderDetails;
