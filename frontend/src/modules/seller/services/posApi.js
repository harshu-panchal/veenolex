import axiosInstance from "@core/api/axios";

/**
 * sellerPosApi — Axios client wrappers for Seller POS endpoints.
 */
export const sellerPosApi = {
  // Orders
  createOrder: (data) => axiosInstance.post("/seller/pos/orders", data),
  getInvoiceReport: (params) => axiosInstance.get("/seller/pos/orders/pos-report", { params }),

  // State Sync
  getState: () => axiosInstance.get("/seller/pos/state"),
  updateState: (data) => axiosInstance.put("/seller/pos/state", data),

  // Bill Settings
  getBillSettings: () => axiosInstance.get("/seller/pos/bill-settings"),
  updateBillSettings: (data) => axiosInstance.put("/seller/pos/bill-settings", data),

  // Customers
  getPOSCustomers: (params) => axiosInstance.get("/seller/pos/customers", { params }),
  createPOSCustomer: (data) => axiosInstance.post("/seller/pos/customers", data),

  // Catalog
  getPOSProducts: (params) => axiosInstance.get("/seller/pos/products", { params }),

  // Own Categories
  getOwnCategories: () => axiosInstance.get("/seller/pos/own-categories"),
  createOwnCategory: (data) => axiosInstance.post("/seller/pos/own-categories", data),
  deleteOwnCategory: (id) => axiosInstance.delete(`/seller/pos/own-categories/${id}`),

  // Own SubCategories
  getOwnSubCategories: (params) => axiosInstance.get("/seller/pos/own-subcategories", { params }),
  createOwnSubCategory: (data) => axiosInstance.post("/seller/pos/own-subcategories", data),
  
  // Online credit payments
  initiateOnlineCreditPayment: (data) => axiosInstance.post("/seller/pos/credit/payment/initiate", data),
  verifyOnlineCreditPayment: (merchantOrderId) => axiosInstance.post("/seller/pos/credit/payment/verify", { merchantOrderId }),
};

export default sellerPosApi;
