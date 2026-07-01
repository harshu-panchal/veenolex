import React, { useState } from "react";
import { SellerDashboardSummary } from "./SellerDashboardSummary";
import { SellerOrdersList } from "./SellerOrdersList";
import { SellerReports } from "./SellerReports";

export const SellerPanelLast40Days = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  
  return (
    <div style={{
      maxWidth: "1200px",
      margin: "0 auto"
    }}>
      
      {/* TAB NAVIGATION */}
      <div style={{
        display: "flex",
        gap: "12px",
        padding: "16px",
        borderBottom: "1px solid #e0e0e0",
        backgroundColor: "#f9f9f9"
      }}>
        
        <button onClick={() => setActiveTab("dashboard")} style={{
          padding: "10px 16px",
          backgroundColor: activeTab === "dashboard" ? "#3B9FD9" : "white",
          color: activeTab === "dashboard" ? "white" : "#333",
          border: "1px solid #ddd",
          borderRadius: "8px",
          cursor: "pointer",
          fontWeight: "500",
          transition: "all 0.3s ease"
        }}>
          \uD83D\uDCCA Dashboard
        </button>
        
        <button onClick={() => setActiveTab("orders")} style={{
          padding: "10px 16px",
          backgroundColor: activeTab === "orders" ? "#3B9FD9" : "white",
          color: activeTab === "orders" ? "white" : "#333",
          border: "1px solid #ddd",
          borderRadius: "8px",
          cursor: "pointer",
          fontWeight: "500",
          transition: "all 0.3s ease"
        }}>
          \uD83D\uDCE6 Orders
        </button>
        
        <button onClick={() => setActiveTab("reports")} style={{
          padding: "10px 16px",
          backgroundColor: activeTab === "reports" ? "#3B9FD9" : "white",
          color: activeTab === "reports" ? "white" : "#333",
          border: "1px solid #ddd",
          borderRadius: "8px",
          cursor: "pointer",
          fontWeight: "500",
          transition: "all 0.3s ease"
        }}>
          \uD83D\uDCC8 Reports
        </button>
        
      </div>
      
      {/* TAB CONTENT */}
      <div>
        {activeTab === "dashboard" && <SellerDashboardSummary />}
        {activeTab === "orders" && <SellerOrdersList />}
        {activeTab === "reports" && <SellerReports />}
      </div>
      
    </div>
  );
};
