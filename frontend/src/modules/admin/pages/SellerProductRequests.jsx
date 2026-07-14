import React, { useState, useEffect } from "react";
import adminApi from "../services/adminApi";
import { toast } from "sonner";
import {
  getAllSellerRequests,
  approveRequest,
  rejectRequest,
  triggerDeliveryBroadcast,
  manualAssignDelivery,
  assignShiprocketDelivery,
  formatPrice,
  formatDate,
  getStatusColor
} from "../../../services/sellerProductRequestService";

export default function SellerProductRequests() {

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [adminNote, setAdminNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(null);
  
  const handleTriggerBroadcast = async (requestId) => {
    try {
      setActionLoading(requestId + "_broadcast");
      await triggerDeliveryBroadcast(requestId);
      toast.success("Delivery Broadcast started!");
      
      setRequests(requests.map(r => 
        r._id === requestId ? { ...r, deliveryWorkflowStatus: "DELIVERY_SEARCH" } : r
      ));
    } catch (err) {
      toast.error("Failed to trigger broadcast: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssignShiprocket = async (requestId) => {
    try {
      setActionLoading(requestId + "_shiprocket");
      const res = await assignShiprocketDelivery(requestId);
      toast.success("Shiprocket delivery assigned successfully!");
      
      if (res && res.request) {
        setRequests(requests.map(r => 
          r._id === requestId ? res.request : r
        ));
      } else {
        setRequests(requests.map(r => 
          r._id === requestId ? { ...r, deliveryType: "SHIPROCKET", deliveryWorkflowStatus: "DELIVERY_ASSIGNED" } : r
        ));
      }
    } catch (err) {
      toast.error("Failed to assign Shiprocket delivery: " + (err.message || err));
    } finally {
      setActionLoading(null);
    }
  };

  const [showDriverModal, setShowDriverModal] = useState(null); // stores requestId
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [isFetchingDrivers, setIsFetchingDrivers] = useState(false);

  const openDriverModal = async (requestId) => {
    setShowDriverModal(requestId);
    setIsFetchingDrivers(true);
    try {
      const response = await adminApi.getDeliveryPartners({ status: 'active', limit: 100 });
      const payload = response.data.result || {};
      const data = Array.isArray(payload.items) ? payload.items : (response.data.results || response.data.result || []);
      setAvailableDrivers(data);
    } catch (err) {
      toast.error("Failed to fetch drivers: " + err.message);
    } finally {
      setIsFetchingDrivers(false);
    }
  };

  const handleManualAssign = async (requestId, driver) => {
    try {
      const deliveryBoyId = driver._id || driver.id;
      setActionLoading(requestId + "_assign");
      await manualAssignDelivery(requestId, deliveryBoyId);
      toast.success("Delivery boy assigned successfully!");

      // Update local state WITH the full driver object so it doesn't show "Unknown Driver"
      setRequests(requests.map((r) =>
        r._id === requestId ? { ...r, deliveryBoy: driver, deliveryWorkflowStatus: "DELIVERY_ASSIGNED" } : r
      ));
    } catch (err) {
      toast.error("Failed to assign delivery: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const [stats, setStats] = useState([]);

  // ─────────────────────────────────
  // FETCH ALL REQUESTS
  // ─────────────────────────────────
  useEffect(() => {
    loadRequests();
  }, [filterStatus]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {};
      if (filterStatus !== "ALL") params.status = filterStatus;

      const response = await getAllSellerRequests(params);
      setRequests(response.data || []);
      setStats(response.stats || []);

      console.log("✅ Requests loaded:", response.data?.length);

    } catch (err) {
      setError("Failed to load requests");
      console.error("❌ Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────
  // APPROVE REQUEST
  // ─────────────────────────────────
  const handleApprove = async (requestId, startDelivery = false) => {
    try {
      setActionLoading(requestId + "_approve");

      await approveRequest(requestId, adminNote, startDelivery);

      // Update local state
      setRequests(requests.map((r) =>
        r._id === requestId
          ? { ...r, status: "APPROVED", adminNote }
          : r
      ));

      setSelectedRequest(null);
      setAdminNote("");

      toast.success(startDelivery ? "Request approved and Delivery Broadcast started!" : "Request approved successfully!");

    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      toast.error("Failed to approve: " + msg);
    } finally {
      setActionLoading(null);
    }
  };

  // ─────────────────────────────────
  // REJECT REQUEST
  // ─────────────────────────────────
  const handleReject = async (requestId) => {
    if (!rejectReason.trim()) {
      alert("Please enter a reason for rejection");
      return;
    }

    try {
      setActionLoading(requestId + "_reject");

      await rejectRequest(requestId, rejectReason);

      // Update local state
      setRequests(requests.map((r) =>
        r._id === requestId
          ? { ...r, status: "REJECTED", rejectedReason: rejectReason }
          : r
      ));

      setShowRejectModal(null);
      setRejectReason("");

      alert("Request rejected.");

    } catch (err) {
      toast.error("Failed to reject: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // ─────────────────────────────────
  // GET STAT COUNT
  // ─────────────────────────────────
  const getStatCount = (status) => {
    const stat = stats.find((s) => s._id === status);
    return stat?.count || 0;
  };

  // ─────────────────────────────────
  // RENDER
  // ─────────────────────────────────
  return (
    <div style={{
      padding: "24px",
      backgroundColor: "#f5f5f5",
      minHeight: "100vh"
    }}>

      {/* HEADER */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{
          fontSize: "24px",
          fontWeight: "700",
          color: "#333",
          margin: "0 0 6px"
        }}>
          📦 Seller Product Requests
        </h1>
        <p style={{
          fontSize: "14px",
          color: "#666",
          margin: "0"
        }}>
          Review and manage product requests from sellers
        </p>
      </div>

      {/* STATS CARDS */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: "12px",
        marginBottom: "24px"
      }}>
        {[
          { label: "Total", status: null, color: "#3B9FD9", emoji: "📊" },
          { label: "Pending", status: "PENDING", color: "#FF7A00", emoji: "⏳" },
          { label: "Approved", status: "APPROVED", color: "#27AE60", emoji: "✅" },
          { label: "Rejected", status: "REJECTED", color: "#E74C3C", emoji: "❌" },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              backgroundColor: "white",
              borderRadius: "10px",
              padding: "16px",
              border: `2px solid ${card.color}20`,
              textAlign: "center",
              cursor: "pointer"
            }}
            onClick={() =>
              setFilterStatus(card.status || "ALL")
            }
          >
            <p style={{
              fontSize: "24px",
              margin: "0 0 4px"
            }}>
              {card.emoji}
            </p>
            <p style={{
              fontSize: "22px",
              fontWeight: "800",
              color: card.color,
              margin: "0 0 4px"
            }}>
              {card.status
                ? getStatCount(card.status)
                : requests.length}
            </p>
            <p style={{
              fontSize: "12px",
              color: "#666",
              margin: "0",
              fontWeight: "500"
            }}>
              {card.label}
            </p>
          </div>
        ))}
      </div>

      {/* FILTER TABS */}
      <div style={{
        display: "flex",
        gap: "8px",
        marginBottom: "20px",
        flexWrap: "wrap"
      }}>
        {["ALL", "PENDING", "APPROVED", "REJECTED", "DISPATCHED"].map(
          (status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              style={{
                padding: "8px 16px",
                borderRadius: "20px",
                border: "none",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "600",
                backgroundColor:
                  filterStatus === status ? "#3B9FD9" : "#e0e0e0",
                color: filterStatus === status ? "white" : "#666",
                transition: "all 0.2s"
              }}
            >
              {status}
            </button>
          )
        )}
      </div>

      {/* LOADING */}
      {loading && (
        <div style={{
          textAlign: "center",
          padding: "60px",
          color: "#999"
        }}>
          ⏳ Loading requests...
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div style={{
          backgroundColor: "#FFEBEE",
          padding: "16px",
          borderRadius: "8px",
          color: "#C62828",
          marginBottom: "16px"
        }}>
          ❌ {error}
        </div>
      )}

      {/* EMPTY */}
      {!loading && requests.length === 0 && (
        <div style={{
          textAlign: "center",
          padding: "60px",
          backgroundColor: "white",
          borderRadius: "12px",
          color: "#999"
        }}>
          <p style={{ fontSize: "40px", margin: "0 0 12px" }}>📭</p>
          <p style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 6px" }}>
            No requests found
          </p>
          <p style={{ fontSize: "14px", margin: "0" }}>
            Seller requests will appear here
          </p>
        </div>
      )}

      {/* REQUEST CARDS */}
      {!loading && requests.map((request) => {
        const statusColor = getStatusColor(request.status);
        return (
          <div
            key={request._id}
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              border: "1px solid #e0e0e0",
              marginBottom: "16px",
              overflow: "hidden"
            }}
          >
            {/* REQUEST HEADER */}
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid #f0f0f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px"
            }}>
              <div>
                <p style={{
                  fontSize: "16px",
                  fontWeight: "700",
                  color: "#333",
                  margin: "0 0 4px"
                }}>
                  {request.requestNumber}
                </p>
                <p style={{
                  fontSize: "12px",
                  color: "#999",
                  margin: "0"
                }}>
                  📅 {formatDate(request.createdAt)} •
                  👤 {request.sellerName}
                </p>
              </div>

              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "10px"
              }}>
                {/* PAYMENT TYPE BADGE */}
                <span style={{
                  padding: "4px 12px",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: "600",
                  backgroundColor:
                    request.paymentType === "PAY_NOW"
                      ? "#E3F2FD"
                      : "#FFF3E0",
                  color:
                    request.paymentType === "PAY_NOW"
                      ? "#3B9FD9"
                      : "#FF7A00"
                }}>
                  {request.paymentType === "PAY_NOW"
                    ? "💳 Paid"
                    : "📦 Pay After Delivery"}
                </span>

                {/* STATUS BADGE */}
                <span style={{
                  padding: "6px 14px",
                  borderRadius: "12px",
                  fontSize: "12px",
                  fontWeight: "700",
                  backgroundColor: statusColor.bg,
                  color: statusColor.text,
                  border: `1px solid ${statusColor.border}`
                }}>
                  {request.status}
                </span>
              </div>
            </div>

            {/* ITEMS */}
            <div style={{ padding: "16px 20px" }}>
              {request.items?.slice(0, 3).map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                    fontSize: "13px"
                  }}
                >
                  <span style={{ color: "#666" }}>
                    {item.productName} × {item.quantity}
                  </span>
                  <span style={{ fontWeight: "600" }}>
                    {formatPrice(item.totalPrice)}
                  </span>
                </div>
              ))}
              {request.items?.length > 3 && (
                <p style={{
                  fontSize: "12px",
                  color: "#999",
                  margin: "4px 0 0"
                }}>
                  +{request.items.length - 3} more items
                </p>
              )}
            </div>

            {/* FOOTER */}
            <div style={{
              padding: "14px 20px",
              backgroundColor: "#f9f9f9",
              borderTop: "1px solid #f0f0f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px"
            }}>
              <p style={{
                fontSize: "18px",
                fontWeight: "800",
                color: "#27AE60",
                margin: "0"
              }}>
                Total: {formatPrice(request.totalAmount)}
              </p>

              {/* ACTIONS */}
              
              {request.status === "APPROVED" && !request.deliveryBoy && (!request.deliveryWorkflowStatus || request.deliveryWorkflowStatus === "PENDING" || request.deliveryWorkflowStatus === "DELIVERY_SEARCH") && request.deliveryType !== "SHIPROCKET" && (
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => handleTriggerBroadcast(request._id)}
                    disabled={actionLoading === request._id + "_broadcast"}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#3498DB",
                      border: "none",
                      borderRadius: "6px",
                      color: "#fff",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    {actionLoading === request._id + "_broadcast" ? "..." : "📡 Broadcast"}
                  </button>
                  <button
                    onClick={() => openDriverModal(request._id)}
                    disabled={actionLoading === request._id + "_assign" || showDriverModal === request._id}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#F39C12",
                      border: "none",
                      borderRadius: "6px",
                      color: "#fff",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    {actionLoading === request._id + "_assign" ? "..." : "👤 Manual Assigned"}
                  </button>
                  <button
                    onClick={() => handleAssignShiprocket(request._id)}
                    disabled={actionLoading === request._id + "_shiprocket"}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#9B59B6",
                      border: "none",
                      borderRadius: "6px",
                      color: "#fff",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    {actionLoading === request._id + "_shiprocket" ? "..." : "🚀 Shiprocket"}
                  </button>
                </div>
              )}
              {request.status === "PENDING" && (
                <div style={{
                  display: "flex",
                  gap: "10px"
                }}>
                  <button
                    onClick={() => setShowRejectModal(request._id)}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "white",
                      border: "2px solid #E74C3C",
                      borderRadius: "8px",
                      color: "#E74C3C",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "600"
                    }}
                  >
                    ❌ Reject
                  </button>
                  <button
                    onClick={() => handleApprove(request._id)}
                    disabled={actionLoading === request._id + "_approve"}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#27AE60",
                      border: "none",
                      borderRadius: "8px",
                      color: "white",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "600"
                    }}
                  >
                    {actionLoading === request._id + "_approve"
                      ? "⏳ Approving..."
                      : "✅ Approve"}
                  </button>
                </div>
              )}

              {/* VIEW DETAIL */}
              <button
                onClick={() =>
                  setSelectedRequest(
                    selectedRequest?._id === request._id
                      ? null
                      : request
                  )
                }
                style={{
                  padding: "8px 16px",
                  backgroundColor: "white",
                  border: "2px solid #3B9FD9",
                  borderRadius: "8px",
                  color: "#3B9FD9",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600"
                }}
              >
                👁 {selectedRequest?._id === request._id
                  ? "Hide"
                  : "View"} Details
              </button>
            </div>

            {/* EXPANDED DETAIL */}
            {selectedRequest?._id === request._id && (
              <div style={{
                padding: "20px",
                borderTop: "2px solid #3B9FD9",
                backgroundColor: "#F0F7FF"
              }}>
                <p style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#333",
                  margin: "0 0 12px"
                }}>
                  Full Order Details
                </p>
                {request.items?.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid #e0e0e0",
                      fontSize: "13px"
                    }}
                  >
                    <span>{item.productName}</span>
                    <span>
                      {formatPrice(item.pricePerUnit)} ×{" "}
                      {item.quantity} = {formatPrice(item.totalPrice)}
                    </span>
                  </div>
                ))}
                {request.sellerNote && (
                  <div style={{
                    marginTop: "12px",
                    backgroundColor: "white",
                    padding: "10px 12px",
                    borderRadius: "6px"
                  }}>
                    <p style={{
                      fontSize: "12px",
                      color: "#666",
                      margin: "0"
                    }}>
                      📝 Seller Note: {request.sellerNote}
                    </p>
                  </div>
                )}

                {/* DELIVERY TRACKING SECTION */}
                {(request.deliveryBoy || request.deliveryType === "SHIPROCKET") && (
                  <div style={{
                    marginTop: "16px",
                    backgroundColor: "white",
                    padding: "16px",
                    borderRadius: "10px",
                    border: request.deliveryType === "SHIPROCKET" ? "2px solid #9B59B6" : "2px solid #27AE60"
                  }}>
                    <p style={{
                      fontSize: "14px",
                      fontWeight: "700",
                      color: request.deliveryType === "SHIPROCKET" ? "#9B59B6" : "#27AE60",
                      margin: "0 0 12px"
                    }}>
                      🚚 Delivery Tracking
                    </p>

                    {/* Driver Info or Shiprocket Info */}
                    {request.deliveryType === "SHIPROCKET" ? (
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        marginBottom: "12px",
                        padding: "10px",
                        backgroundColor: "#F4ECF7",
                        borderRadius: "8px"
                      }}>
                        <div style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "50%",
                          backgroundColor: "#9B59B6",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "20px",
                          fontWeight: "bold"
                        }}>
                          🚀
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: "0 0 2px", fontWeight: "700", fontSize: "14px", color: "#9B59B6" }}>
                            Shiprocket Standard Delivery
                          </p>
                          <p style={{ margin: "0", fontSize: "12px", color: "#666" }}>
                            AWB: {request.shipRocketDetails?.trackingNumber || "Assigning..."}
                          </p>
                          <p style={{
                            margin: "4px 0 0",
                            fontSize: "11px",
                            color: "#8E44AD",
                            fontWeight: "600"
                          }}>
                            Status: {request.shipRocketDetails?.status || "NEW"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        marginBottom: "12px",
                        padding: "10px",
                        backgroundColor: "#F0FFF4",
                        borderRadius: "8px"
                      }}>
                        <div style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "50%",
                          backgroundColor: "#27AE60",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "20px",
                          fontWeight: "bold"
                        }}>
                          {request.deliveryBoy.name?.charAt(0) || "?"}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: "0 0 2px", fontWeight: "700", fontSize: "14px" }}>
                            {request.deliveryBoy.name || "Unknown Driver"}
                          </p>
                          <p style={{ margin: "0", fontSize: "12px", color: "#666" }}>
                            📞 {request.deliveryBoy.phone || "N/A"}
                            {request.deliveryBoy.vehicleDetails?.vehicleType && (
                              <span> • 🏍️ {request.deliveryBoy.vehicleDetails.vehicleType}</span>
                            )}
                          </p>
                          <p style={{
                            margin: "4px 0 0",
                            fontSize: "11px",
                            color: request.deliveryBoy.isOnline ? "#27AE60" : "#E74C3C",
                            fontWeight: "600"
                          }}>
                            {request.deliveryBoy.isOnline ? "● Online" : "○ Offline"}
                            {request.deliveryBoy.lastLocationAt && (
                              <span style={{ color: "#999", fontWeight: "400", marginLeft: "8px" }}>
                                Last seen: {new Date(request.deliveryBoy.lastLocationAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Workflow Status */}
                    <div style={{
                      display: "flex",
                      gap: "6px",
                      flexWrap: "wrap",
                      marginBottom: "12px"
                    }}>
                      {["DELIVERY_ASSIGNED", "PICKUP_READY", "OUT_FOR_DELIVERY", "DELIVERED"].map(step => {
                        const statusOrder = ["DELIVERY_ASSIGNED", "PICKUP_READY", "OUT_FOR_DELIVERY", "DELIVERED"];
                        const currentIdx = statusOrder.indexOf(request.deliveryWorkflowStatus);
                        const stepIdx = statusOrder.indexOf(step);
                        const isDone = stepIdx <= currentIdx;
                        const isCurrent = step === request.deliveryWorkflowStatus;
                        const labels = {
                          "DELIVERY_ASSIGNED": "Assigned",
                          "PICKUP_READY": "At Pickup",
                          "OUT_FOR_DELIVERY": "On the Way",
                          "DELIVERED": "Delivered"
                        };
                        return (
                          <span key={step} style={{
                            padding: "4px 10px",
                            borderRadius: "20px",
                            fontSize: "11px",
                            fontWeight: "600",
                            backgroundColor: isCurrent ? (request.deliveryType === "SHIPROCKET" ? "#9B59B6" : "#27AE60") : isDone ? (request.deliveryType === "SHIPROCKET" ? "#D2B4DE" : "#A3D9A5") : "#E0E0E0",
                            color: isCurrent ? "white" : isDone ? (request.deliveryType === "SHIPROCKET" ? "#4A235A" : "#1A5C2A") : "#999"
                          }}>
                            {isDone ? "✓ " : ""}{labels[step]}
                          </span>
                        );
                      })}
                    </div>

                    {/* Live Location */}
                    {request.deliveryBoy && request.deliveryBoy.location?.coordinates && (
                      <div style={{
                        padding: "10px",
                        backgroundColor: "#EBF5FB",
                        borderRadius: "8px",
                        fontSize: "12px"
                      }}>
                        <p style={{ margin: "0 0 6px", fontWeight: "600", color: "#2C3E50" }}>
                          📍 Live Location
                        </p>
                        <p style={{ margin: "0 0 4px", color: "#555" }}>
                          Lat: {request.deliveryBoy.location.coordinates[1]?.toFixed(6)},
                          Lng: {request.deliveryBoy.location.coordinates[0]?.toFixed(6)}
                        </p>
                        <a
                          href={`https://www.google.com/maps?q=${request.deliveryBoy.location.coordinates[1]},${request.deliveryBoy.location.coordinates[0]}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-block",
                            padding: "6px 14px",
                            backgroundColor: "#3498DB",
                            color: "white",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "600",
                            textDecoration: "none",
                            marginTop: "6px"
                          }}
                        >
                          🗺️ Open in Google Maps
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* No delivery assigned message */}
                {request.status === "APPROVED" && !request.deliveryBoy && request.deliveryType !== "SHIPROCKET" && (
                  <div style={{
                    marginTop: "12px",
                    padding: "10px 12px",
                    backgroundColor: "#FFF9E6",
                    borderRadius: "6px",
                    border: "1px solid #F39C12"
                  }}>
                    <p style={{ fontSize: "12px", color: "#856404", margin: "0" }}>
                      ⚠️ No delivery partner assigned yet. Use "Broadcast" or "Manual Assigned" to start delivery.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* REJECT MODAL */}
      {showRejectModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px"
        }}>
          <div style={{
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "24px",
            maxWidth: "400px",
            width: "100%"
          }}>
            <h3 style={{
              fontSize: "18px",
              fontWeight: "700",
              margin: "0 0 16px",
              color: "#333"
            }}>
              ❌ Reject Request
            </h3>
            <p style={{
              fontSize: "13px",
              color: "#666",
              margin: "0 0 12px"
            }}>
              Please provide a reason for rejection:
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={4}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "13px",
                fontFamily: "inherit",
                resize: "vertical",
                boxSizing: "border-box",
                outline: "none",
                marginBottom: "16px"
              }}
            />
            <div style={{
              display: "flex",
              gap: "10px"
            }}>
              <button
                onClick={() => {
                  setShowRejectModal(null);
                  setRejectReason("");
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor: "white",
                  border: "2px solid #ddd",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#666"
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(showRejectModal)}
                disabled={actionLoading === showRejectModal + "_reject"}
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor: "#E74C3C",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600"
                }}
              >
                {actionLoading === showRejectModal + "_reject"
                  ? "⏳ Rejecting..."
                  : "❌ Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* DRIVER PICKER MODAL */}
      {showDriverModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center",
          alignItems: "center", zIndex: 9999
        }}>
          <div style={{
            backgroundColor: "#fff", padding: "24px", borderRadius: "12px",
            width: "500px", maxWidth: "90%", maxHeight: "80vh", overflowY: "auto"
          }}>
            <h3 style={{ marginTop: 0, marginBottom: "16px", color: "#2C3E50" }}>Select a Delivery Partner</h3>
            {isFetchingDrivers ? (
              <p>Fetching active drivers...</p>
            ) : availableDrivers.length === 0 ? (
              <p>No active verified drivers found.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {availableDrivers.map(driver => (
                  <div key={driver._id || driver.id} style={{
                    padding: "12px", border: "1px solid #eee", borderRadius: "8px",
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <div>
                      <h4 style={{ margin: "0 0 4px 0" }}>{driver.name || "Unknown"}</h4>
                      <p style={{ margin: 0, fontSize: "12px", color: "#7F8C8D" }}>
                        {driver.vehicleDetails?.vehicleType || "Vehicle"} • {driver.phone || "No Phone"}
                      </p>
                      <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: driver.isOnline ? "#27AE60" : "#E74C3C" }}>
                        {driver.isOnline ? "● Online" : "○ Offline"} {driver.isVerified && " (Verified)"}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        handleManualAssign(showDriverModal, driver);
                        setShowDriverModal(null);
                      }}
                      style={{
                        padding: "6px 12px", backgroundColor: "#F39C12",
                        color: "#fff", border: "none", borderRadius: "4px",
                        cursor: "pointer", fontWeight: "bold"
                      }}
                    >
                      Assign
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: "20px", textAlign: "right" }}>
              <button 
                onClick={() => setShowDriverModal(null)}
                style={{
                  padding: "8px 16px", backgroundColor: "#ECF0F1", color: "#34495E",
                  border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold"
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
