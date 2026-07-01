import React, { useState, useEffect } from "react";
import { getSellerTransactionReport, getSellerSalesReport } from "../services/sellerPanelDataService";
import { Last40DaysBadge } from "./Last40DaysBadge";

export const SellerReports = () => {
  const [transactionData, setTransactionData] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        const [trans, sales] = await Promise.all([
          getSellerTransactionReport(),
          getSellerSalesReport()
        ]);
        setTransactionData(trans.data || {});
        setSalesData(sales.data || {});
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchReports();
  }, []);
  
  if (loading) {
    return <div style={{ padding: "20px", textAlign: "center" }}>⏳ Loading Reports...</div>;
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
        📊 Financial Reports (Last 40 Days)
      </h3>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: "16px"
      }}>
        
        {/* Transaction Summary Card */}
        <div style={{
          backgroundColor: "white",
          padding: "20px",
          borderRadius: "12px",
          border: "1px solid #e0e0e0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
        }}>
          <h4 style={{ margin: "0 0 16px", color: "#1565C0", fontSize: "16px" }}>💳 Transactions</h4>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ color: "#666" }}>Total Volume:</span>
            <span style={{ fontWeight: "600" }}>₹{transactionData?.totalAmount?.toLocaleString("en-IN") || 0}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ color: "#666" }}>Total Transactions:</span>
            <span style={{ fontWeight: "600" }}>{transactionData?.totalCount || 0}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ color: "#666" }}>Successful:</span>
            <span style={{ color: "#27AE60", fontWeight: "600" }}>{transactionData?.successfulCount || 0}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>Failed/Pending:</span>
            <span style={{ color: "#C62828", fontWeight: "600" }}>{transactionData?.failedCount || 0}</span>
          </div>
        </div>

        {/* Sales Summary Card */}
        <div style={{
          backgroundColor: "white",
          padding: "20px",
          borderRadius: "12px",
          border: "1px solid #e0e0e0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
        }}>
          <h4 style={{ margin: "0 0 16px", color: "#2E7D32", fontSize: "16px" }}>💰 Sales Activity</h4>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ color: "#666" }}>Total Revenue:</span>
            <span style={{ fontWeight: "600" }}>₹{salesData?.totalRevenue?.toLocaleString("en-IN") || 0}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ color: "#666" }}>Completed Orders:</span>
            <span style={{ fontWeight: "600" }}>{salesData?.completedOrders || 0}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ color: "#666" }}>Average Order Value:</span>
            <span style={{ fontWeight: "600" }}>₹{salesData?.averageOrderValue?.toLocaleString("en-IN") || 0}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>Items Sold:</span>
            <span style={{ fontWeight: "600" }}>{salesData?.totalItemsSold || 0}</span>
          </div>
        </div>

      </div>
    </div>
  );
};
