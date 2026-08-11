import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import { sellerApi } from '../services/sellerApi';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { HiOutlineArrowLeft, HiOutlineShoppingBag, HiOutlineTruck } from 'react-icons/hi2';

const RequestedOrdersList = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Delivery Assignment state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTargetRequest, setAssignTargetRequest] = useState(null);
  const [deliveryPartners, setDeliveryPartners] = useState([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const res = await sellerApi.getSellerRequests({ limit: 50 });
      if (res.data.success) {
        setRequests(res.data.data);
      } else {
        toast.error("Failed to load requests");
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast.error("An error occurred while fetching requests");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      const res = await sellerApi.getDeliveryPartners();
      const driversList = res.data?.results || res.data?.result || res.data?.data || (Array.isArray(res.data) ? res.data : []);
      setDeliveryPartners(Array.isArray(driversList) ? driversList : []);
    } catch (e) {
      console.error("Failed to load delivery partners:", e);
    }
  };

  const handleOpenAssignModal = (req) => {
    setAssignTargetRequest(req);
    setSelectedDriverId('');
    setIsAssignModalOpen(true);
    fetchDrivers();
  };

  const handleBroadcastDelivery = async (requestId) => {
    try {
      await sellerApi.broadcastRequestDelivery(requestId);
      toast.success("📡 Delivery broadcast sent to nearby delivery partners!");
      setIsAssignModalOpen(false);
      fetchRequests();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to broadcast delivery");
    }
  };

  const handleManualAssignDriver = async (requestId, driverId) => {
    if (!driverId) {
      toast.error("Please select a delivery partner");
      return;
    }
    try {
      await sellerApi.assignRequestDeliveryBoy(requestId, driverId);
      toast.success("Delivery partner assigned successfully!");
      setIsAssignModalOpen(false);
      fetchRequests();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to assign delivery partner");
    }
  };

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

  return (
    <div style={{ padding: "24px", backgroundColor: "#f5f5f5", minHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
        <button
          onClick={() => navigate("/seller/request-product")}
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
            Requested Orders
          </h1>
          <p style={{ fontSize: "14px", color: "#666", margin: "0" }}>
            Track your product requests from the admin
          </p>
        </div>
      </div>

      <Card padding="lg">
        {isLoading ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "#666" }}>Loading requests...</div>
        ) : requests.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "#666" }}>
            <HiOutlineShoppingBag size={48} color="#ccc" style={{ marginBottom: "16px" }} />
            <p>You have not made any product requests yet.</p>
            <button
              onClick={() => navigate("/seller/request-product")}
              style={{
                marginTop: "16px",
                padding: "8px 16px",
                backgroundColor: "#3B9FD9",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer"
              }}
            >
              Request Products
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>
                  <th style={{ padding: "12px", color: "#666", fontWeight: "600" }}>Request ID</th>
                  <th style={{ padding: "12px", color: "#666", fontWeight: "600" }}>Date</th>
                  <th style={{ padding: "12px", color: "#666", fontWeight: "600" }}>Items</th>
                  <th style={{ padding: "12px", color: "#666", fontWeight: "600" }}>Total</th>
                  <th style={{ padding: "12px", color: "#666", fontWeight: "600" }}>Status</th>
                  <th style={{ padding: "12px", color: "#666", fontWeight: "600", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req._id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "16px 12px", fontWeight: "500", color: "#333" }}>
                      {req.requestNumber}
                    </td>
                    <td style={{ padding: "16px 12px", color: "#666" }}>
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "16px 12px", color: "#666" }}>
                      {req.items?.length || 0} items
                    </td>
                    <td style={{ padding: "16px 12px", fontWeight: "600", color: "#333" }}>
                      {formatPrice(req.totalAmount)}
                    </td>
                    <td style={{ padding: "16px 12px" }}>
                      {getStatusBadge(req.status)}
                    </td>
                    <td style={{ padding: "16px 12px", textAlign: "right" }}>
                      <button
                        onClick={() => navigate(`/seller/requested-orders/${req._id}`)}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "transparent",
                          color: "#3B9FD9",
                          border: "1px solid #3B9FD9",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "13px",
                          fontWeight: "500"
                        }}
                      >
                        View Tracking
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Assign Delivery Modal */}
      {isAssignModalOpen && assignTargetRequest && (
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
                Request #{assignTargetRequest.requestNumber}
              </p>
            </div>

            <div className="space-y-4">
              {/* Option A: Broadcast */}
              <button
                onClick={() => handleBroadcastDelivery(assignTargetRequest._id)}
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
                  onClick={() => handleManualAssignDriver(assignTargetRequest._id, selectedDriverId)}
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

export default RequestedOrdersList;
