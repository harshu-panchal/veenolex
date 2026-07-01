import React, { useState, useEffect } from "react";
import { OfflineSalesForm } from "./OfflineSalesForm";
import { OfflineSalesHistory } from "./OfflineSalesHistory";
import { OfflineSalesReceipt } from "./OfflineSalesReceipt";
import { useOfflineSales } from "../hooks/useOfflineSales";
import axiosInstance from "../core/api/axios";

export const SellerOfflineSalesTab = ({ sellerInfo = null }) => {
  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════
  const [activeTab, setActiveTab] = useState("form"); // "form", "history", "stats"
  const [sellerProducts, setSellerProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);

  const {
    sales,
    stats,
    loading,
    error,
    successMessage,
    recordSale,
    fetchHistory,
    fetchStats,
    deleteSale,
    refreshData
  } = useOfflineSales();

  // ═══════════════════════════════════════════════════════════════
  // FETCH SELLER PRODUCTS ON MOUNT
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    fetchSellerProducts();
    fetchAllData();
  }, []);

  const fetchSellerProducts = async () => {
    try {
      setLoadingProducts(true);

      console.log("📦 Fetching seller products...");

      const response = await axiosInstance.get("/products/seller/me");

      if (response.data.success) {
        const products = response.data.result?.items || [];
        setSellerProducts(products);
        console.log("✅ Products loaded:", products.length);
      }

    } catch (error) {
      console.error("❌ Error fetching products:", error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchAllData = async () => {
    try {
      await fetchHistory();
    } catch (error) {
      console.error("❌ Error fetching data:", error);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // HANDLE SALE RECORDED
  // ═══════════════════════════════════════════════════════════════
  const handleSaleRecorded = async (response) => {
    console.log("✅ Sale recorded! Refreshing data...");

    // Show receipt
    setLastReceipt(response.receipt);
    setShowReceipt(true);

    // Refresh products (stock updated)
    await fetchSellerProducts();

    // Refresh data
    await refreshData();
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={{
      backgroundColor: "#f9f9f9",
      borderRadius: "12px",
      overflow: "hidden"
    }}>

      {/* HEADER */}
      <div style={{
        backgroundColor: "white",
        borderBottom: "1px solid #e0e0e0",
        padding: "16px"
      }}>
        <h2 style={{
          fontSize: "18px",
          fontWeight: "bold",
          margin: "0",
          color: "#333"
        }}>
          🛒 Offline Sales Management
        </h2>
        <p style={{
          fontSize: "12px",
          color: "#999",
          margin: "4px 0 0"
        }}>
          Record and manage offline sales made at your physical store
        </p>
      </div>

      {/* TAB NAVIGATION */}
      <div style={{
        display: "flex",
        gap: "0",
        backgroundColor: "white",
        borderBottom: "1px solid #e0e0e0",
        padding: "0 16px"
      }}>

        <button
          onClick={() => setActiveTab("form")}
          style={{
            padding: "12px 16px",
            backgroundColor: activeTab === "form" ? "white" : "transparent",
            color: activeTab === "form" ? "#3B9FD9" : "#666",
            border: "none",
            borderBottom: activeTab === "form" ? "3px solid #3B9FD9" : "none",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: activeTab === "form" ? "600" : "500",
            transition: "all 0.3s ease",
            position: "relative"
          }}
        >
          ➕ Record Sale
        </button>

        <button
          onClick={() => setActiveTab("history")}
          style={{
            padding: "12px 16px",
            backgroundColor: activeTab === "history" ? "white" : "transparent",
            color: activeTab === "history" ? "#3B9FD9" : "#666",
            border: "none",
            borderBottom: activeTab === "history" ? "3px solid #3B9FD9" : "none",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: activeTab === "history" ? "600" : "500",
            transition: "all 0.3s ease"
          }}
        >
          📋 Sales History
          {sales.length > 0 && (
            <span style={{
              marginLeft: "6px",
              backgroundColor: "#FF7A00",
              color: "white",
              padding: "2px 6px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: "600"
            }}>
              {sales.length}
            </span>
          )}
        </button>

      </div>

      {/* CONTENT */}
      <div style={{
        padding: "20px"
      }}>

        {/* FORM TAB */}
        {activeTab === "form" && (
          <div>
            {loadingProducts ? (
              <div style={{
                textAlign: "center",
                padding: "40px",
                color: "#999"
              }}>
                ⏳ Loading your products...              </div>
            ) : sellerProducts.length === 0 ? (
              <div style={{
                backgroundColor: "#FFF3E0",
                border: "1px solid #FFE0B2",
                borderRadius: "8px",
                padding: "16px",
                textAlign: "center"
              }}>
                <p style={{
                  fontSize: "13px",
                  color: "#FF7A00",
                  margin: "0"
                }}>
                  ⚠️ No products available. Please add products first.
                </p>
              </div>
            ) : (
              <OfflineSalesForm
                sellerProducts={sellerProducts}
                onSaleRecorded={handleSaleRecorded}
              />
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === "history" && (
          <OfflineSalesHistory
            sellerProducts={sellerProducts}
            onSaleDeleted={() => {
              fetchSellerProducts();
              refreshData();
            }}
          />
        )}



      </div>

      {/* RECEIPT MODAL */}
      {showReceipt && lastReceipt && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px"
        }}>

          <div style={{
            backgroundColor: "white",
            borderRadius: "12px",
            maxWidth: "500px",
            width: "100%",
            maxHeight: "90vh",
            overflow: "auto",
            padding: "20px"
          }}>

            <OfflineSalesReceipt
              sale={lastReceipt}
              sellerInfo={sellerInfo}
              onClose={() => setShowReceipt(false)}
            />

          </div>

        </div>
      )}

    </div>
  );
};

