import axiosInstance from '@core/api/axios';

/**
 * Admin warehouse fulfilment: orders no local seller could fulfil.
 */
export const adminFulfillmentApi = {
    getFulfillmentOrders: (params) =>
        axiosInstance.get('/admin/fulfillment/orders', { params }),
    acceptFulfillmentOrder: (orderId) =>
        axiosInstance.post(`/admin/fulfillment/orders/${orderId}/accept`),
    rejectFulfillmentOrder: (orderId, reason) =>
        axiosInstance.post(`/admin/fulfillment/orders/${orderId}/reject`, { reason }),
    dispatchFulfillmentOrder: (orderId, data) =>
        axiosInstance.post(`/admin/fulfillment/orders/${orderId}/dispatch`, data),
    getWarehouseSettings: () =>
        axiosInstance.get('/admin/fulfillment/warehouse'),
    updateWarehouseSettings: (data) =>
        axiosInstance.put('/admin/fulfillment/warehouse', data),
};

export default adminFulfillmentApi;
