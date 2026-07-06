import axiosInstance from "../core/api/axios";

const API_BASE = "/seller-requests";
const PRODUCTS_API = "/products";

// ═══════════════════════════════════════════
// FETCH ALL ADMIN PRODUCTS (for seller to browse)
// ═══════════════════════════════════════════
export const fetchAdminProducts = async (params = {}) => {
  try {
    console.log("📦 Fetching admin products...");

    const response = await axiosInstance.get(PRODUCTS_API, {
      params: {
        limit: 50,
        page: 1,
        status: "active",
        approvalStatus: "approved",
        ...params
      }
    });

    let products =
      response.data?.data?.items ||
      (Array.isArray(response.data?.data) ? response.data.data : null) ||
      response.data?.result?.items ||
      response.data?.products ||
      [];
      
    if (!Array.isArray(products)) {
        products = [];
    }

    console.log("✅ Products fetched:", products.length);
    return products;

  } catch (error) {
    console.error("❌ Error fetching products:", error);
    throw error;
  }
};

// ═══════════════════════════════════════════
// SELLER: CREATE PRODUCT REQUEST
// ═══════════════════════════════════════════
export const createProductRequest = async (requestData) => {
  try {
    console.log("📤 Creating product request...");

    const response = await axiosInstance.post(
      `${API_BASE}/create`,
      requestData
    );

    console.log("✅ Request created:", response.data);
    return response.data;

  } catch (error) {
    console.error("❌ Error creating request:", error);
    throw error;
  }
};

// ═══════════════════════════════════════════
// SELLER: GET MY REQUESTS
// ═══════════════════════════════════════════
export const getMyRequests = async (params = {}) => {
  try {
    const response = await axiosInstance.get(
      `${API_BASE}/my-requests`,
      { params }
    );
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching requests:", error);
    throw error;
  }
};

// ═══════════════════════════════════════════
// ADMIN: GET ALL REQUESTS
// ═══════════════════════════════════════════
export const getAllSellerRequests = async (params = {}) => {
  try {
    console.log("📋 Admin fetching all requests...");

    const response = await axiosInstance.get(
      `${API_BASE}/admin/all`,
      { params }
    );

    console.log("✅ Requests fetched:", response.data);
    return response.data;

  } catch (error) {
    console.error("❌ Error fetching all requests:", error);
    throw error;
  }
};

// ═══════════════════════════════════════════
// ADMIN: APPROVE REQUEST
// ═══════════════════════════════════════════
export const approveRequest = async (requestId, adminNote = "", startDelivery = false) => {
  try {
    console.log("✅ Approving request:", requestId);

    const response = await axiosInstance.patch(
      `${API_BASE}/admin/${requestId}/approve`,
      { adminNote, startDelivery }
    );

    return response.data;

  } catch (error) {
    console.error("❌ Error approving:", error);
    throw error;
  }
};

// ═══════════════════════════════════════════
// ADMIN: REJECT REQUEST
// ═══════════════════════════════════════════
export const rejectRequest = async (requestId, rejectedReason = "") => {
  try {
    console.log("❌ Rejecting request:", requestId);

    const response = await axiosInstance.patch(
      `${API_BASE}/admin/${requestId}/reject`,
      { rejectedReason }
    );

    return response.data;

  } catch (error) {
    console.error("❌ Error rejecting:", error);
    throw error;
  }
};

// ═══════════════════════════════════════════
// FORMAT CURRENCY
// ═══════════════════════════════════════════
export const formatPrice = (amount) =>
  `₹${(amount || 0).toLocaleString("en-IN")}`;

// ═══════════════════════════════════════════
// FORMAT DATE
// ═══════════════════════════════════════════
export const formatDate = (date) =>
  new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

// ═══════════════════════════════════════════
// GET STATUS COLOR
// ═══════════════════════════════════════════
export const getStatusColor = (status) => {
  const colors = {
    PENDING: { bg: "#FFF3E0", text: "#FF7A00", border: "#FFE0B2" },
    APPROVED: { bg: "#E8F5E9", text: "#27AE60", border: "#A5D6A7" },
    REJECTED: { bg: "#FFEBEE", text: "#E74C3C", border: "#FFCDD2" },
    DISPATCHED: { bg: "#E3F2FD", text: "#3B9FD9", border: "#BBDEFB" },
    DELIVERED: { bg: "#F3E5F5", text: "#9C27B0", border: "#CE93D8" },
    CANCELLED: { bg: "#F5F5F5", text: "#999", border: "#E0E0E0" }
  };
  return colors[status] || colors.PENDING;
};


export const triggerDeliveryBroadcast = async (requestId) => {
  try {
    const response = await axiosInstance.patch(
      `${API_BASE}/admin/${requestId}/trigger-delivery`
    );
    return response.data;
  } catch (error) {
    console.error("❌ API Error triggering delivery broadcast:", error);
    throw error.response?.data || error;
  }
};

export const manualAssignDelivery = async (requestId, deliveryBoyId) => {
  try {
    const response = await axiosInstance.patch(
      `${API_BASE}/admin/${requestId}/assign-delivery`,
      { deliveryBoyId }
    );
    return response.data;
  } catch (error) {
    console.error("❌ API Error manually assigning delivery:", error);
    throw error.response?.data || error;
  }
};
