/**
 * Thin wrapper over the backend REST API.
 *
 * The multi-role flows use this to drive state transitions that belong to a
 * *different* actor than the one whose UI is under test — logging four browser
 * contexts in and clicking through every dashboard would make each spec depend
 * on the stability of screens it isn't actually asserting on.
 *
 * Endpoint paths mirror backend/app/routes/*.js and backend/index.js.
 */

import { config } from './config.js'

/** Backend wraps every response as { success, message, result }. */
const unwrap = async (response, label) => {
  const status = response.status()
  let body
  try {
    body = await response.json()
  } catch {
    throw new Error(`${label} → ${status} with a non-JSON body`)
  }
  if (!response.ok() || body?.success === false) {
    throw new Error(`${label} → ${status}: ${body?.message || JSON.stringify(body)}`)
  }
  return body.result ?? body
}

export class ApiClient {
  constructor(request, token = null) {
    this.request = request
    this.token = token
  }

  withToken(token) {
    return new ApiClient(this.request, token)
  }

  headers(extra = {}) {
    return {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...extra,
    }
  }

  async get(path, params) {
    const response = await this.request.get(`${config.apiURL}${path}`, {
      headers: this.headers(),
      params,
    })
    return unwrap(response, `GET ${path}`)
  }

  async post(path, data) {
    const response = await this.request.post(`${config.apiURL}${path}`, {
      headers: this.headers(),
      data,
    })
    return unwrap(response, `POST ${path}`)
  }

  async patch(path, data) {
    const response = await this.request.patch(`${config.apiURL}${path}`, {
      headers: this.headers(),
      data,
    })
    return unwrap(response, `PATCH ${path}`)
  }

  async put(path, data) {
    const response = await this.request.put(`${config.apiURL}${path}`, {
      headers: this.headers(),
      data,
    })
    return unwrap(response, `PUT ${path}`)
  }
}

/* ── Authentication ──────────────────────────────────────────────────────── */

export async function loginCustomer(request, { phone, otp }) {
  const api = new ApiClient(request)
  await api.post('/customer/send-login-otp', { phone })
  const result = await api.post('/customer/verify-otp', { phone, otp })
  return { token: result.token, user: result.customer }
}

export async function loginDelivery(request, { phone, otp }) {
  const api = new ApiClient(request)
  await api.post('/delivery/send-login-otp', { phone })
  const result = await api.post('/delivery/verify-otp', { phone, otp })
  return { token: result.token, user: result.delivery }
}

export async function loginSeller(request, { email, password }) {
  const api = new ApiClient(request)
  const result = await api.post('/seller/login', { email, password })
  return { token: result.token, user: result.seller }
}

export async function loginAdmin(request, { email, password }) {
  const api = new ApiClient(request)
  const result = await api.post('/admin/login', { email, password })
  return { token: result.token, user: result.admin }
}

export const loginAs = {
  customer: loginCustomer,
  delivery: loginDelivery,
  seller: loginSeller,
  admin: loginAdmin,
}

/* ── Order lifecycle ─────────────────────────────────────────────────────── */

export const orders = {
  place: (api, payload) => api.post('/orders/place', payload),
  mine: (api) => api.get('/orders/my-orders'),
  details: (api, orderId) => api.get(`/orders/details/${orderId}`),

  sellerQueue: (api) => api.get('/orders/seller-orders'),
  setStatus: (api, orderId, payload) => api.put(`/orders/status/${orderId}`, payload),

  deliveryPartners: (api) => api.get('/orders/delivery-partners'),
  assignRider: (api, orderId, payload) => api.put(`/orders/${orderId}/assign-delivery-boy`, payload),
  broadcast: (api, orderId, payload) => api.put(`/orders/${orderId}/broadcast-delivery`, payload),

  availableForRider: (api) => api.get('/orders/available'),
  riderAccept: (api, orderId) => api.post(`/orders/accept/${orderId}`),
  riderSkip: (api, orderId) => api.post(`/orders/skip/${orderId}`),

  confirmPickup: (api, orderId, payload) => api.post(`/orders/workflow/${orderId}/pickup/confirm`, payload),
  markReadyForPickup: (api, orderId, payload) => api.post(`/orders/workflow/${orderId}/pickup/ready`, payload),

  requestOtp: (api, orderId, payload) => api.post(`/orders/workflow/${orderId}/otp/request`, payload),
  activeOtp: (api, orderId) => api.get(`/orders/workflow/${orderId}/otp/active`),
  verifyOtp: (api, orderId, payload) => api.post(`/orders/workflow/${orderId}/otp/verify`, payload),
}

/* ── Seller → Admin product requests ─────────────────────────────────────── */

export const productRequests = {
  create: (api, payload) => api.post('/seller-requests/create', payload),
  mine: (api) => api.get('/seller-requests/my-requests'),
  detail: (api, requestId) => api.get(`/seller-requests/my-requests/${requestId}`),

  adminList: (api, params) => api.get('/seller-requests/admin/all', params),
  approve: (api, requestId, payload) => api.patch(`/seller-requests/admin/${requestId}/approve`, payload),
  reject: (api, requestId, payload) => api.patch(`/seller-requests/admin/${requestId}/reject`, payload),
  triggerDelivery: (api, requestId, payload) =>
    api.patch(`/seller-requests/admin/${requestId}/trigger-delivery`, payload),
  assignDelivery: (api, requestId, payload) =>
    api.patch(`/seller-requests/admin/${requestId}/assign-delivery`, payload),
}

/* ── Catalog (read-only, safe anywhere) ──────────────────────────────────── */

export const catalog = {
  products: (api, params) => api.get('/products', params),
  categories: (api) => api.get('/categories'),
}
