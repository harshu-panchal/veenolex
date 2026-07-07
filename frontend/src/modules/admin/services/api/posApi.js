import axiosInstance from "@core/api/axios";

/**
 * adminPosApi — Axios client wrappers for Admin POS endpoints.
 */
export const adminPosApi = {
  // Orders
  createOrder: (data) => axiosInstance.post("/admin/orders/pos", data),
  createOnlineOrder: (data) => axiosInstance.post("/admin/orders/pos/online", data),
  verifyOnlinePayment: (orderId) => axiosInstance.post("/admin/orders/pos/verify", { orderId }),
  updateOrderItems: (id, data) => axiosInstance.patch(`/admin/orders/${id}/items`, data),
  exchangeItems: (data) => axiosInstance.post("/admin/pos/exchange", data),
  deleteOrder: (id) => axiosInstance.delete(`/admin/orders/pos/${id}`),
  getInvoiceReport: (params) => axiosInstance.get("/admin/orders/pos-report", { params }),

  // Catalog
  getPOSProducts: (params) => axiosInstance.get("/admin/products/pos", { params }),
  getProductByBarcode: (code) => axiosInstance.get("/admin/products/pos/barcode", { params: { code } }),

  // Reports
  getPOSReport: (params) => axiosInstance.get("/admin/pos/report", { params }),
  getStockLedger: (params) => axiosInstance.get("/admin/pos/stock-ledger", { params }),
  updateStockLedger: (id, data) => axiosInstance.put(`/admin/pos/stock-ledger/${id}`, data),

  // Purchase/Quotation Drafts
  getPurchaseEntries: (params) => axiosInstance.get("/admin/pos/purchase-entries", { params }),
  savePurchaseEntry: (data) => axiosInstance.post("/admin/pos/purchase-entries", data),
  deletePurchaseEntry: (id) => axiosInstance.delete(`/admin/pos/purchase-entries/${id}`),

  // Credit / Udhaar
  getCreditCustomers: (params) => axiosInstance.get("/admin/pos/credit/customers", { params }),
  getCreditHistory: (customerId, params) => axiosInstance.get(`/admin/pos/credit/history/${customerId}`, { params }),
  addCredit: (data) => axiosInstance.post("/admin/pos/credit/add", data),
  recordCreditPayment: (data) => axiosInstance.post("/admin/pos/credit/payment", data),
  initiateOnlineCreditPayment: (data) => axiosInstance.post("/admin/pos/credit/payment/initiate", data),
  verifyOnlineCreditPayment: (merchantOrderId) => axiosInstance.post("/admin/pos/credit/payment/verify", { merchantOrderId }),

  // Suppliers
  getSuppliers: (params) => axiosInstance.get("/admin/pos/suppliers", { params }),
  getSupplierById: (id) => axiosInstance.get(`/admin/pos/suppliers/${id}`),
  createSupplier: (data) => axiosInstance.post("/admin/pos/suppliers", data),
  updateSupplier: (id, data) => axiosInstance.put(`/admin/pos/suppliers/${id}`, data),
  deleteSupplier: (id) => axiosInstance.delete(`/admin/pos/suppliers/${id}`),
  recordSupplierDebt: (id, data) => axiosInstance.post(`/admin/pos/suppliers/${id}/debt`, data),
  recordSupplierPayment: (id, data) => axiosInstance.post(`/admin/pos/suppliers/${id}/pay`, data),

  // GST Register
  getGstRegister: (params) => axiosInstance.get("/admin/reports/gst-register", { params }),
  createGstEntry: (data) => axiosInstance.post("/admin/reports/gst-register", data),
  updateGstEntry: (id, data) => axiosInstance.patch(`/admin/reports/gst-register/${id}`, data),
  deleteGstEntry: (id) => axiosInstance.delete(`/admin/reports/gst-register/${id}`),
};

export default adminPosApi;
