import React, { useState, useEffect } from "react";
import { getSellerDashboardSummary } from "../services/sellerPanelDataService";
import { Last40DaysBadge } from "./Last40DaysBadge";

export const SellerDashboardSummary = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const data = await getSellerDashboardSummary();
        setSummary(data);
      } catch (err) {
        console.error("Error loading dashboard:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSummary();
  }, []);
  
  if (loading) {
    return (
      <div style={{
        textAlign: "center",
        padding: "40px",
        color: "#999"
      }}>
        <p>⏳ Loading last 40 days data...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div style={{
        backgroundColor: "#FFEBEE",
        padding: "16px",
        borderRadius: "8px",
        color: "#C62828"
      }}>
        <p>❌ Error loading data: {error}</p>
      </div>
    );
  }
  
  const orders = summary?.orders?.data || [];
  const sales = summary?.sales || {};
  const transactions = summary?.transactions?.data || {};
  
  return (
    <div style={{
      padding: "16px"
    }}>
      
      {/* LAST 40 DAYS BADGE */}
      <Last40DaysBadge />
      
      {/* SUMMARY CARDS */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "16px",
        marginBottom: "20px"
      }}>
        
        {/* TOTAL ORDERS */}
        <div style={{
          backgroundColor: "#f9f9f9",
          padding: "16px",
          borderRadius: "12px",
          border: "1px solid #e0e0e0"
        }}>
          <p style={{
            fontSize: "12px",
            color: "#999",
            margin: "0 0 8px",
            fontWeight: "500"
          }}>
            \uD83D\uDCE6 Total Orders
          </p>
          <p style={{
            fontSize: "24px",
            fontWeight: "bold",
            margin: "0",
            color: "#333"
          }}>
            {orders.length || 0}
          </p>
          <p style={{
            fontSize: "11px",
            color: "#999",
            margin: "8px 0 0"
          }}>
            Last 40 days
          </p>
        </div>
        
        {/* TOTAL REVENUE */}
        <div style={{
          backgroundColor: "#f9f9f9",
          padding: "16px",
          borderRadius: "12px",
          border: "1px solid #e0e0e0"
        }}>
          <p style={{
            fontSize: "12px",
            color: "#999",
            margin: "0 0 8px",
            fontWeight: "500"
          }}>
            \uD83D\uDCB0 Total Revenue
          </p>
          <p style={{
            fontSize: "24px",
            fontWeight: "bold",
            margin: "0",
            color: "#27AE60"
          }}>
            ₹{sales?.totalSales?.toLocaleString("en-IN") || "0"}
          </p>
          <p style={{
            fontSize: "11px",
            color: "#999",
            margin: "8px 0 0"
          }}>
            Last 40 days
          </p>
        </div>
        
        {/* AVG ORDER VALUE */}
        <div style={{
          backgroundColor: "#f9f9f9",
          padding: "16px",
          borderRadius: "12px",
          border: "1px solid #e0e0e0"
        }}>
          <p style={{
            fontSize: "12px",
            color: "#999",
            margin: "0 0 8px",
            fontWeight: "500"
          }}>
            \uD83D\uDCCA Avg Order Value
          </p>
          <p style={{
            fontSize: "24px",
            fontWeight: "bold",
            margin: "0",
            color: "#3B9FD9"
          }}>
            ₹{sales?.avgOrderValue?.toFixed(2) || "0"}
          </p>
          <p style={{
            fontSize: "11px",
            color: "#999",
            margin: "8px 0 0"
          }}>
            Last 40 days
          </p>
        </div>
        
        {/* COMPLETED ORDERS */}
        <div style={{
          backgroundColor: "#f9f9f9",
          padding: "16px",
          borderRadius: "12px",
          border: "1px solid #e0e0e0"
        }}>
          <p style={{
            fontSize: "12px",
            color: "#999",
            margin: "0 0 8px",
            fontWeight: "500"
          }}>
            \u2713 Completed Orders
          </p>
          <p style={{
            fontSize: "24px",
            fontWeight: "bold",
            margin: "0",
            color: "#27AE60"
          }}>
            {sales?.totalOrders || 0}
          </p>
          <p style={{
            fontSize: "11px",
            color: "#999",
            margin: "8px 0 0"
          }}>
            Last 40 days
          </p>
        </div>
        
      </div>
      
    </div>
  );
};
