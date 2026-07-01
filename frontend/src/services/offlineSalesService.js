import axiosInstance from "../core/api/axios";

const API_BASE = "/offline-sales";

// ═══════════════════════════════════════════════════════════════
// Record a new offline sale
// ═══════════════════════════════════════════════════════════════
export const recordOfflineSale = async (saleData) => {
  try {
    console.log("📤 Submitting offline sale...", saleData);

    const response = await axiosInstance.post(`${API_BASE}/record`, saleData);

    console.log("✅ Sale recorded:", response.data);
    return response.data;

  } catch (error) {
    console.error("❌ Error recording sale:", error.response?.data?.message);
    throw error.response?.data || { message: "Failed to record sale" };
  }
};

// ═══════════════════════════════════════════════════════════════
// Fetch offline sales history
// ═══════════════════════════════════════════════════════════════
export const fetchOfflineSalesHistory = async (filters = {}) => {
  try {
    console.log("📋 Fetching offline sales history...");

    // Build query string from filters
    const queryParams = new URLSearchParams();
    if (filters.productId) queryParams.append("productId", filters.productId);
    if (filters.startDate) queryParams.append("startDate", filters.startDate);
    if (filters.endDate) queryParams.append("endDate", filters.endDate);

    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";

    const response = await axiosInstance.get(`${API_BASE}/history${queryString}`);

    console.log("✅ History fetched:", response.data.count, "sales");
    return response.data;

  } catch (error) {
    console.error("❌ Error fetching history:", error.response?.data?.message);
    throw error.response?.data || { message: "Failed to fetch history" };
  }
};

// ═══════════════════════════════════════════════════════════════
// Fetch offline sales statistics
// ═══════════════════════════════════════════════════════════════
export const fetchOfflineSalesStats = async (days = 30) => {
  try {
    console.log("📊 Fetching offline sales stats...");

    const response = await axiosInstance.get(`${API_BASE}/stats?days=${days}`);

    console.log("✅ Stats fetched:", response.data.stats);
    return response.data;

  } catch (error) {
    console.error("❌ Error fetching stats:", error.response?.data?.message);
    throw error.response?.data || { message: "Failed to fetch stats" };
  }
};

// ═══════════════════════════════════════════════════════════════
// Delete an offline sale (and restore stock)
// ═══════════════════════════════════════════════════════════════
export const deleteOfflineSale = async (saleId) => {
  try {
    console.log("🗑️ Deleting offline sale:", saleId);

    const response = await axiosInstance.delete(`${API_BASE}/${saleId}`);

    console.log("✅ Sale deleted:", response.data);
    return response.data;

  } catch (error) {
    console.error("❌ Error deleting sale:", error.response?.data?.message);
    throw error.response?.data || { message: "Failed to delete sale" };
  }
};

// ═══════════════════════════════════════════════════════════════
// Format date for display
// ═══════════════════════════════════════════════════════════════
export const formatSaleDate = (date) => {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

// ═══════════════════════════════════════════════════════════════
// Format currency
// ═══════════════════════════════════════════════════════════════
export const formatCurrency = (amount) => {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};
