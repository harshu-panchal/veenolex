import axiosInstance from "@core/api/axios";

// ═══════════════════════════════════════════════════════════════
// FETCH ALL CUSTOMERS FOR DROPDOWN
// Uses: GET /api/admin/users
// Response: { success, result: { items: [...], total } }
// ═══════════════════════════════════════════════════════════════
export const fetchCustomersForDropdown = async () => {
  try {
    console.log("👥 Fetching customers for dropdown...");

    const response = await axiosInstance.get(
      `/admin/users`,
      {
        params: {
          limit: 100,  // Fetch up to 100 customers for dropdown
          page: 1
        }
      }
    );

    // Extract items from correct path: result.items
    const customers = response.data?.result?.items || [];

    console.log("✅ Customers fetched:", customers.length);
    return customers;

  } catch (error) {
    console.error(
      "❌ Error fetching customers:",
      error.response?.status,
      error.response?.data?.message
    );
    throw error;
  }
};

// ═══════════════════════════════════════════════════════════════
// FORMAT CUSTOMER FOR DROPDOWN
// Maps API fields to dropdown-ready format
// ═══════════════════════════════════════════════════════════════
export const formatCustomerForDropdown = (customer) => {
  return {
    id: customer.id,                   // "6a3bb079a38bdde21b9676ce"
    name: customer.name,               // "Unnamed Customer"
    phone: customer.phone,             // "+919999999999"
    email: customer.email,             // "customer@example.com"
    avatar: customer.avatar,           // "https://api.dicebear.com/..."
    status: customer.status,           // "active"
    totalOrders: customer.totalOrders, // 5
    totalSpent: customer.totalSpent,   // 2500
    joinedDate: customer.joinedDate,   // "2026-06-25T..."
    lastOrderDate: customer.lastOrderDate, // "2026-06-30T..."

    // Display label for dropdown
    label: `${customer.name} | ${customer.phone}`
  };
};

// ═══════════════════════════════════════════════════════════════
// SEND PUSH NOTIFICATION TO SELECTED CUSTOMERS
// ═══════════════════════════════════════════════════════════════
export const sendNotificationToCustomers = async ({
  customerIds,
  title,
  message,
  template
}) => {
  try {
    console.log("📤 Sending push notification...");
    console.log(
      "Recipients:",
      customerIds === "ALL"
        ? "All Customers"
        : `${customerIds.length} customer(s)`
    );

    const payload = {
      audience: customerIds === "ALL" ? "all_customers" : "specific",
      customerIds: customerIds === "ALL" ? [] : customerIds,
      title: title,
      message: message,
      template: template || null,
      sentAt: new Date().toISOString()
    };

    console.log("📦 Payload:", payload);

    const response = await axiosInstance.post(
      `/admin/notifications/send`,
      payload
    );

    console.log("✅ Notification sent:", response.data);
    return response.data;

  } catch (error) {
    console.error(
      "❌ Error sending notification:",
      error.response?.data?.message || error.message
    );
    throw error;
  }
};

// ═══════════════════════════════════════════════════════════════
// FORMAT DATE FOR DISPLAY
// ═══════════════════════════════════════════════════════════════
export const formatCustomerDate = (dateString) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
};

// ═══════════════════════════════════════════════════════════════
// FORMAT CURRENCY
// ═══════════════════════════════════════════════════════════════
export const formatCustomerSpend = (amount) => {
  return `₹${(amount || 0).toLocaleString("en-IN")}`;
};
