import { useState, useCallback, useEffect } from "react";
import {
  recordOfflineSale,
  fetchOfflineSalesHistory,
  fetchOfflineSalesStats,
  deleteOfflineSale
} from "../services/offlineSalesService";

export const useOfflineSales = () => {
  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════
  const [sales, setSales] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [lastSaleRecorded, setLastSaleRecorded] = useState(null);

  // ═══════════════════════════════════════════════════════════════
  // RECORD NEW SALE
  // ═══════════════════════════════════════════════════════════════
  const recordSale = useCallback(async (saleData) => {
    try {
      setLoading(true);
      setError(null);

      console.log("📤 Recording sale with hook...");

      const response = await recordOfflineSale(saleData);

      if (response.success) {
        // Update last recorded sale
        setLastSaleRecorded(response);

        // Show success message
        setSuccessMessage({
          message: "✅ Sale recorded successfully!",
          productName: response.productName,
          quantitySold: response.quantitySold,
          newStock: response.newStock
        });

        console.log("✅ Sale recorded:", response.saleId);

        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000);

        return response;
      }

    } catch (err) {
      console.error("❌ Error recording sale:", err);
      setError(err.message || "Failed to record sale");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // FETCH HISTORY
  // ═══════════════════════════════════════════════════════════════
  const fetchHistory = useCallback(async (filters = {}) => {
    try {
      setLoading(true);
      setError(null);

      console.log("📋 Fetching history with hook...");

      const response = await fetchOfflineSalesHistory(filters);

      setSales(response.data || []);

      console.log("✅ History loaded:", response.count, "sales");

      return response;

    } catch (err) {
      console.error("❌ Error fetching history:", err);
      setError(err.message || "Failed to fetch history");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // FETCH STATISTICS
  // ═══════════════════════════════════════════════════════════════
  const fetchStats = useCallback(async (days = 30) => {
    try {
      setLoading(true);
      setError(null);

      console.log("📊 Fetching stats with hook...");

      const response = await fetchOfflineSalesStats(days);

      setStats(response.stats);

      console.log("✅ Stats loaded");

      return response;

    } catch (err) {
      console.error("❌ Error fetching stats:", err);
      setError(err.message || "Failed to fetch stats");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // DELETE SALE
  // ═══════════════════════════════════════════════════════════════
  const deleteSale = useCallback(async (saleId) => {
    try {
      setLoading(true);
      setError(null);

      console.log("🗑️ Deleting sale with hook...");

      const response = await deleteOfflineSale(saleId);

      if (response.success) {
        // Remove from list
        setSales(sales.filter(s => s._id !== saleId));

        // Show success
        setSuccessMessage({
          message: "✅ Sale deleted and stock restored!",
          restoredQuantity: response.restoredQuantity
        });

        console.log("✅ Sale deleted");

        // Clear message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000);

        return response;
      }

    } catch (err) {
      console.error("❌ Error deleting sale:", err);
      setError(err.message || "Failed to delete sale");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sales]);

  // ═══════════════════════════════════════════════════════════════
  // REFRESH DATA
  // ═══════════════════════════════════════════════════════════════
  const refreshData = useCallback(async (filters = {}) => {
    try {
      await Promise.all([
        fetchHistory(filters),
        fetchStats(30)
      ]);
      console.log("✅ Data refreshed");
    } catch (err) {
      console.error("❌ Error refreshing data:", err);
    }
  }, [fetchHistory, fetchStats]);

  // ═══════════════════════════════════════════════════════════════
  // CLEAR MESSAGES
  // ═══════════════════════════════════════════════════════════════
  const clearMessages = useCallback(() => {
    setError(null);
    setSuccessMessage(null);
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // RETURN HOOK DATA
  // ═══════════════════════════════════════════════════════════════
  return {
    // State
    sales,
    stats,
    loading,
    error,
    successMessage,
    lastSaleRecorded,

    // Functions
    recordSale,
    fetchHistory,
    fetchStats,
    deleteSale,
    refreshData,
    clearMessages
  };
};
