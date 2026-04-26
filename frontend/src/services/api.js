import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
});

// ── Attach JWT token to every request ───────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Global response error handler ────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message || 'An unexpected error occurred';
    const statusCode = error.response?.status || 500;
    const errors = error.response?.data?.errors || null;

    // 401 on ANY protected route means the token is expired or user deactivated.
    // Log the user out globally so they are redirected to /login.
    if (statusCode === 401) {
      localStorage.removeItem('accessToken');
      window.dispatchEvent(new Event('auth:logout'));
    }

    if (statusCode === 429) {
      console.warn('Rate limit reached — too many requests.');
    }

    return Promise.reject({ message, statusCode, errors });
  }
);

// ── Tab-close token clearing ─────────────────────────────────────────────────
// Simple approach: JWT expires in 7 days (set in backend .env JWT_EXPIRES_IN).
// On any 401 response, the token is cleared globally (see interceptor above).
// No complex pagehide logic needed — keep it simple.

// ── Unified API exports ──────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
  me:       ()     => api.get('/auth/me'),
  logout:   ()     => api.post('/auth/logout').finally(() => localStorage.removeItem('accessToken')),
};

export const booksAPI = {
  getAll:  (params) => api.get('/books', { params }),
  getById: (id)     => api.get(`/books/${id}`),
  create:  (data)   => api.post('/books', data),
  upload:  (file)   => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/books/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  update: (id, data) => api.put(`/books/${id}`, data),
  delete: (id)       => api.delete(`/books/${id}`),
};

export const libraryCardsAPI = {
  apply:         (data)         => api.post('/library-cards/apply', data),
  getMyCard:     ()             => api.get('/library-cards/my-card'),
  getAll:        (params)       => api.get('/library-cards', { params }),
  approve:       (id)           => api.patch(`/library-cards/${id}/approve`),
  reject:        (id, reason)   => api.patch(`/library-cards/${id}/reject`, { reason }),
  collect:       (id)           => api.patch(`/library-cards/${id}/collect`),
  requestReturn: (id)           => api.patch(`/library-cards/${id}/request-return`),
  returnBook:    (id)           => api.patch(`/library-cards/${id}/return`),
  runExpire:     ()             => api.post('/library-cards/run-expire'),
};

export const issuesAPI = {
  getAll:     (params) => api.get('/issues', { params: { limit: 100, ...(params || {}) } }),
  getById:    (id)     => api.get(`/issues/${id}`),
  issueBook:  (data)   => api.post('/issues/issue', data),
  returnBook: (data)   => api.post('/issues/return', data),
  renew:      (id)     => api.post(`/issues/${id}/renew`),
};

export const finesAPI = {
  getAll:       (params)         => api.get('/fines', { params }),
  getMyFines:   ()               => api.get('/fines/my-fines'),
  getById:      (id)             => api.get(`/fines/${id}`),
  pay:          (id, data)       => api.patch(`/fines/${id}/pay`, data),
  markPaid:     (id, amount)     => api.patch(`/fines/${id}/pay`, { amount, paymentMethod: 'upi' }),
  waive:        (id, reason)     => api.patch(`/fines/${id}/waive`, { reason }),
  sendReminders: ()              => api.post('/fines/send-reminders'),
};

export default api;

