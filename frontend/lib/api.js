import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.veritasco.tech/api';

export const getBackendUrl = () => {
  // If we have an explicit remote URL in environment variables, use it.
  if (API_URL && !API_URL.includes('localhost') && !API_URL.includes('127.0.0.1')) {
    return API_URL.replace('/api', '');
  }

  let backend = API_URL.replace('/api', '');
  if (typeof window !== 'undefined') {
    const currentHost = window.location.hostname;
    // If we are on a production domain, but the backend is still pointing to localhost,
    // we need to warn or handle it. For now, we only replace if it was explicitly localhost.
    if (backend.includes('localhost') || backend.includes('127.0.0.1')) {
      if (currentHost !== 'localhost' && currentHost !== '127.0.0.1' && !currentHost.includes('0.0.0.0')) {
        // If we're on a remote site, the backend must be remote too.
        // If not specified, we return the current host (hoping it's a monorepo/same-host setup)
        backend = backend.replace('localhost', currentHost).replace('127.0.0.1', currentHost);
      }
    }
  }
  return backend;
};

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request Interceptor ────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = Cookies.get('access_token') || localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response Interceptor ──────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = Cookies.get('refresh_token') || localStorage.getItem('refresh_token');
        if (refreshToken) {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          const { accessToken, refreshToken: newRefresh } = data.data;
          Cookies.set('access_token', accessToken, { expires: 7, secure: true, sameSite: 'strict' });
          Cookies.set('refresh_token', newRefresh, { expires: 30, secure: true, sameSite: 'strict' });
          original.headers.Authorization = `Bearer ${accessToken}`;
          return api(original);
        }
      } catch {
        // Refresh failed — clear auth and redirect
        Cookies.remove('access_token');
        Cookies.remove('refresh_token');
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
    }
    const message = error.response?.data?.message || error.message || 'Network error';
    return Promise.reject(new Error(message));
  }
);

// ── Auth ───────────────────────────────────────────────────────────────────
export const authApi = {
  login: (data) => api.post('/auth/login', data),
  logout: (refreshToken) => api.post('/auth/logout', { refreshToken }),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  me: () => api.get('/auth/me'),
  changePassword: (data) => api.patch('/auth/change-password', data),
};

// ── Restaurants ────────────────────────────────────────────────────────────
export const restaurantApi = {
  getPublic: (id) => api.get(`/restaurants/public/${id}`),
  getBySlug: (slug) => api.get(`/restaurants/slug/${slug}`),
  getAll: (params) => api.get('/restaurants', { params }),
  getById: (id) => api.get(`/restaurants/${id}`),
  create: (data) => api.post('/restaurants', data),
  update: (id, data) => api.put(`/restaurants/${id}`, data),
  updateLogo: (id, logoUrl) => api.put(`/restaurants/${id}`, { logo: logoUrl }),
  delete: (id) => api.delete(`/restaurants/${id}`),
};

// ── Menu ───────────────────────────────────────────────────────────────────
export const menuApi = {
  getAll: (restaurantId, params) => api.get(`/menu/${restaurantId}`, { params }),
  getCategories: (restaurantId) => api.get(`/menu/${restaurantId}/categories`),
  create: (restaurantId, data) => api.post(`/menu/${restaurantId}`, data),
  update: (restaurantId, itemId, data) => api.put(`/menu/${restaurantId}/${itemId}`, data),
  toggleAvailability: (restaurantId, itemId, is_available) =>
    api.patch(`/menu/${restaurantId}/${itemId}/availability`, { is_available }),
  delete: (restaurantId, itemId) => api.delete(`/menu/${restaurantId}/${itemId}`),
  bulkCreate: (restaurantId, items) => api.post(`/menu/${restaurantId}/bulk`, { items }),
};

// ── Tables ─────────────────────────────────────────────────────────────────
export const tableApi = {
  getAll: (restaurantId, params) => api.get(`/tables/${restaurantId}`, { params }),
  getPublic: (restaurantId, tableNumber, token) => api.get(`/tables/${restaurantId}/public/${tableNumber}${token ? `?token=${token}` : ''}`),
  publicActivate: (restaurantId, tableNumber, data) => api.post(`/tables/${restaurantId}/public/${tableNumber}/activate`, data),
  create: (restaurantId, data) => api.post(`/tables/${restaurantId}`, data),
  activate: (restaurantId, tableId) => api.post(`/tables/${restaurantId}/${tableId}/activate`),
  deactivate: (restaurantId, tableId) => api.post(`/tables/${restaurantId}/${tableId}/deactivate`),
  regenerateQR: (restaurantId) => api.post(`/tables/${restaurantId}/regenerate-qr`),
  delete: (restaurantId, tableId) => api.delete(`/tables/${restaurantId}/${tableId}`),
};

// ── Sessions ───────────────────────────────────────────────────────────────
export const sessionApi = {
  getByTable: (restaurantId, tableNumber) => api.get(`/sessions/table/${restaurantId}/${tableNumber}`),
  getById: (sessionId) => api.get(`/sessions/${sessionId}`),
  getByRestaurant: (restaurantId, params) => api.get(`/sessions/restaurant/${restaurantId}`, { params }),
  updateCart: (sessionId, cart) => api.patch(`/sessions/${sessionId}/cart`, { cart }),
  requestBill: (sessionId) => api.post(`/sessions/${sessionId}/request-bill`),
};

// ── Orders ─────────────────────────────────────────────────────────────────
export const orderApi = {
  place: (data) => api.post('/orders', data),
  getByRestaurant: (restaurantId, params) => api.get(`/orders/restaurant/${restaurantId}`, { params }),
  getBySession: (sessionId) => api.get(`/orders/session/${sessionId}`),
  getKitchen: (restaurantId) => api.get(`/orders/kitchen/${restaurantId}`),
  updateStatus: (orderId, status, note) => api.patch(`/orders/${orderId}/status`, { status, note }),
  cancel: (orderId, reason) => api.patch(`/orders/${orderId}/cancel`, { reason }),
};

// ── Billing ────────────────────────────────────────────────────────────────
export const billingApi = {
  get: (sessionId) => api.get(`/billing/${sessionId}`),
  finalize: (sessionId, discount = 0) => api.post(`/billing/${sessionId}/finalize`, { discount }),
};

// ── Payments ───────────────────────────────────────────────────────────────
export const paymentApi = {
  confirm: (sessionId, data) => api.post(`/payments/${sessionId}/confirm`, data),
  summary: (restaurantId, date) => api.get(`/payments/summary/${restaurantId}`, { params: { date } }),
};

// ── Analytics ──────────────────────────────────────────────────────────────
export const analyticsApi = {
  dashboard: (restaurantId) => api.get(`/analytics/${restaurantId}/dashboard`),
  transactions: (restaurantId, params) => api.get(`/analytics/${restaurantId}/transactions`, { params }),
};

// ── Users ──────────────────────────────────────────────────────────────────
export const userApi = {
  getAll: (params) => api.get('/users', { params }),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  changePassword: (id, password) => api.patch(`/users/${id}/password`, { password }),
  toggleActive: (id, is_active) => api.put(`/users/${id}`, { is_active }),
  delete: (id) => api.delete(`/users/${id}`),
};

// ── Upload ─────────────────────────────────────────────────────────────────
export const uploadApi = {
  image: (file) => {
    const fd = new FormData();
    fd.append('image', file);
    return api.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  logo: (file) => {
    const fd = new FormData();
    fd.append('image', file);
    return api.post('/upload/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export default api;
