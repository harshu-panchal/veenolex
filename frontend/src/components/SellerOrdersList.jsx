import React, { useState, useEffect } from "react";
import { getSellerOrders } from "../services/sellerPanelDataService";
import { Last40DaysBadge } from "./Last40DaysBadge";

export const SellerOrdersList = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const data = await getSellerOrders();
        setOrders(data.data || []);
        console.log("\uD83D\uDCE6 Orders loaded:", data.data?.length, "items");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrders();
  }, []);
  
  if (loading) {
    return <div style={{ padding: "20px", textAlign: "center" }}>⏳ Loading...</div>;
  }
  
  if (error) {
    return (
      <div style={{
        backgroundColor: "#FFEBEE",
        padding: "16px",
        borderRadius: "8px",
        color: "#C62828"
      }}>
        ❌ Error: {error}
      </div>
    );
  }
  
  return (
    <div style={{ padding: "16px" }}>
      
      <Last40DaysBadge />
      
      <h3 style={{
        fontSize: "18px",
        margin: "0 0 16px",
        color: "#333"
      }}>
        \uD83D\uDCE6 Recent Orders (Last 40 Days)
      </h3>
      
      {orders.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "40px",
          backgroundColor: "#f9f9f9",
          borderRadius: "8px",
          color: "#999"
        }}>
          <p>No orders in the last 40 days</p>
        </div>
      ) : (
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}>
          
          {orders.map((order) => (
            <div key={order._id} style={{
              backgroundColor: "white",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px"
            }}>
              
              <div>
                <p style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  margin: "0 0 4px",
                  color: "#333"
                }}>
                  Order #{order._id.slice(-8).toUpperCase()}
                </p>
                <p style={{
                  fontSize: "12px",
                  color: "#999",
                  margin: "0 0 4px"
                }}>
                  {new Date(order.createdAt).toLocaleDateString("en-IN")}
                </p>
                <p style={{
                  fontSize: "12px",
                  color: "#666",
                  margin: "0"
                }}>
                  {order.items?.length || 1} item(s)
                </p>
              </div>
              
              <div style={{
                textAlign: "right"
              }}>
                <p style={{
                  fontSize: "16px",
                  fontWeight: "bold",
                  margin: "0 0 4px",
                  color: "#27AE60"
                }}>
                  ₹{order.pricing?.total?.toLocaleString("en-IN") || "0"}
                </p>
                <span style={{
                  backgroundColor: order.paymentStatus === "PAID" ? "#E8F5E9" : "#FFF3E0",
                  color: order.paymentStatus === "PAID" ? "#27AE60" : "#FF7A00",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: "500"
                }}>
                  {order.paymentStatus || "PENDING"}
                </span>
              </div>
              
            </div>
          ))}
          
        </div>
      )}
    </div>
  );
};
