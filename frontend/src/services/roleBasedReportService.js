import axios from "axios";

const API_BASE = "/api";

/**
 * Fetch transaction report with automatic role-based filtering
 * Seller: Last 40 days
 * Admin: All time
 */
export const fetchTransactionReport = async (dateRange = null) => {
  try {
    const response = await axios.get(
      `${API_BASE}/reports/transaction-report`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        params: dateRange || {}
      }
    );
    
    console.log("\uD83D\uDCCA Transaction Report:", response.data);
    console.log("\uD83D\uDCC5 Data Access:", response.data.dataAccess);
    
    return response.data;
  } catch (error) {
    console.error("Error fetching transaction report:", error);
    throw error;
  }
};

/**
 * Fetch sales report with automatic role-based filtering
 */
export const fetchSalesReport = async () => {
  try {
    const response = await axios.get(
      `${API_BASE}/reports/sales-report`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      }
    );
    
    console.log("\uD83D\uDCB0 Sales Report:", response.data);
    console.log("\uD83D\uDCC5 Data Range:", response.data.dataAccess.dataRange);
    
    return response.data;
  } catch (error) {
    console.error("Error fetching sales report:", error);
    throw error;
  }
};

/**
 * Fetch franchise report with automatic role-based filtering
 */
export const fetchFranchiseReport = async (dateRange = null) => {
  try {
    const response = await axios.get(
      `${API_BASE}/reports/franchises-with-role-filter`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        params: dateRange || {}
      }
    );
    
    console.log("\uD83C\uDFEA Franchise Report:", response.data);
    console.log("\uD83D\uDCC5 Data Range:", response.data.dataAccess.dataRange);
    
    return response.data;
  } catch (error) {
    console.error("Error fetching franchise report:", error);
    throw error;
  }
};

/**
 * Fetch orders with automatic role-based filtering
 */
export const fetchOrdersWithRoleFilter = async () => {
  try {
    const response = await axios.get(
      "/api/orders/seller-view",
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      }
    );
    
    console.log("\uD83D\uDCE6 Orders:", response.data);
    console.log("\uD83D\uDCC5 Data Access:", response.data.dataAccess);
    
    return response.data;
  } catch (error) {
    console.error("Error fetching orders:", error);
    throw error;
  }
};
