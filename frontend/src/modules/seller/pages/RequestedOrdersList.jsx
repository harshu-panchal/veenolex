import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import { sellerApi } from '../services/sellerApi';
import { toast } from 'sonner';
import { HiOutlineArrowLeft, HiOutlineShoppingBag } from 'react-icons/hi2';

const RequestedOrdersList = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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
    </div>
  );
};

export default RequestedOrdersList;
