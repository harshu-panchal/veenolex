import axios from "axios";

const API_BASE = "/api";

/**
 * Get seller's last 40 days orders
 */
export const getSellerOrders = async () => {
  try {
    const response = await axios.get(
      `${API_BASE}/orders/seller-view`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      }
    );
    
    console.log("\uD83D\uDCE6 Seller orders (last 40 days):", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching seller orders:", error);
    throw error;
  }
};

/**
 * Get seller's last 40 days transaction report
 */
export const getSellerTransactionReport = async () => {
  try {
    const response = await axios.get(
      `${API_BASE}/reports/transaction-report`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      }
    );
    
    console.log("\uD83D\uDCB3 Seller transactions (last 40 days):", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching transaction report:", error);
    throw error;
  }
};

/**
 * Get seller's last 40 days sales report
 */
export const getSellerSalesReport = async () => {
  try {
    const response = await axios.get(
      `${API_BASE}/reports/sales-report`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      }
    );
    
    console.log("\uD83D\uDCB0 Seller sales (last 40 days):", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching sales report:", error);
    throw error;
  }
};

/**
 * Get seller's dashboard summary (last 40 days)
 */
export const getSellerDashboardSummary = async () => {
  try {
    const [orders, transactions, sales] = await Promise.all([
      getSellerOrders(),
      getSellerTransactionReport(),
      getSellerSalesReport()
    ]);
    
    return {
      orders,
      transactions,
      sales,
      dataRange: orders.dataAccess?.dataRange || "Last 40 days"
    };
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    throw error;
  }
};
