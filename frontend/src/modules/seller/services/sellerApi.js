import axiosInstance from '@core/api/axios';

export const sellerApi = {
    login: (data) => axiosInstance.post('/seller/login', data),
    signup: (data) => axiosInstance.post('/seller/signup', data),
    sendVerificationOtp: (data) => axiosInstance.post('/seller/verification/send-otp', data),
    verifyVerificationOtp: (data) => axiosInstance.post('/seller/verification/verify-otp', data),
    // Products
    getProducts: (params) => axiosInstance.get('/products/seller/me', { params }),
    getProductById: (id) => axiosInstance.get(`/products/${id}`),
    createProduct: (data) => axiosInstance.post('/products', data),
    updateProduct: (id, data) => axiosInstance.put(`/products/${id}`, data),
    deleteProduct: (id) => axiosInstance.delete(`/products/${id}`),

    // Categories (Public)
    getCategories: () => axiosInstance.get('/admin/categories'),
    getCategoryTree: () => axiosInstance.get('/admin/categories?tree=true'),

    // Others
    getStats: (range) => axiosInstance.get('/seller/stats', { params: { range } }),
    getOrders: (params) => axiosInstance.get('/orders/seller-orders', { params }),
    updateOrderStatus: (orderId, data) => axiosInstance.put(`/orders/status/${orderId}`, data),
    getEarnings: () => axiosInstance.get('/seller/earnings'),
    getWalletSummary: () => axiosInstance.get('/seller/wallet/summary'),
    getProfile: () => axiosInstance.get('/seller/profile'),
    updateProfile: (data) => axiosInstance.put('/seller/profile', data),

    // Stock
    getSellerInventory: (params) => axiosInstance.get('/seller-inventory/my-products', { params }),
    updateInventoryPrice: (inventoryId, data) => axiosInstance.patch(`/seller-inventory/${inventoryId}/price`, data),
    adjustStock: (data) => axiosInstance.post('/products/adjust-stock', data),
    getStockHistory: () => axiosInstance.get('/products/stock-history'),

    // Notifications
    getNotifications: () => axiosInstance.get('/notifications'),
    markNotificationRead: (id) => axiosInstance.put(`/notifications/${id}/read`),
    markAllNotificationsRead: () => axiosInstance.put('/notifications/mark-all-read'),

    // Money Requests
    requestWithdrawal: (data) => axiosInstance.post('/seller/request-withdrawal', data),

    // Returns
    getReturns: (params) => axiosInstance.get('/orders/seller-returns', { params }),
    getReturnDetails: (orderId) => axiosInstance.get(`/orders/${orderId}/returns`),
    approveReturn: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/approve`, data),
    rejectReturn: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/reject`, data),
    assignReturnDelivery: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/assign-delivery`, data),

    // Requested Orders (SellerProductRequest)
    getSellerRequests: (params) => axiosInstance.get('/seller-requests/my-requests', { params }),
    getSellerRequestById: (id) => axiosInstance.get(`/seller-requests/my-requests/${id}`),

    // POS Aggregate
    sellerPos: {
      createOrder: (data) => axiosInstance.post("/seller/pos/orders", data),
      getInvoiceReport: (params) => axiosInstance.get("/seller/pos/orders/pos-report", { params }),
      getState: () => axiosInstance.get("/seller/pos/state"),
      updateState: (data) => axiosInstance.put("/seller/pos/state", data),
      getBillSettings: () => axiosInstance.get("/seller/pos/bill-settings"),
      updateBillSettings: (data) => axiosInstance.put("/seller/pos/bill-settings", data),
      getPOSCustomers: (params) => axiosInstance.get("/seller/pos/customers", { params }),
      createPOSCustomer: (data) => axiosInstance.post("/seller/pos/customers", data),
      getPOSProducts: (params) => axiosInstance.get("/seller/pos/products", { params }),
      getOwnCategories: () => axiosInstance.get("/seller/pos/own-categories"),
      createOwnCategory: (data) => axiosInstance.post("/seller/pos/own-categories", data),
      deleteOwnCategory: (id) => axiosInstance.delete(`/seller/pos/own-categories/${id}`),
      getOwnSubCategories: (params) => axiosInstance.get("/seller/pos/own-subcategories", { params }),
      createOwnSubCategory: (data) => axiosInstance.post("/seller/pos/own-subcategories", data),
      initiateOnlineCreditPayment: (data) => axiosInstance.post("/seller/pos/credit/payment/initiate", data),
      verifyOnlineCreditPayment: (merchantOrderId) => axiosInstance.post("/seller/pos/credit/payment/verify", { merchantOrderId }),
    }
};
