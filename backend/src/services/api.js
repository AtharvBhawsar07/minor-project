import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api' || 'https://minor-project-4rrb.onrender.com/api', // Maps to backend
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Standardize error message extraction
    const message = error.response?.data?.message || error.message || 'An unexpected error occurred';
    const statusCode = error.response?.status || 500;
    const errors = error.response?.data?.errors || null;

    // Only logout on 401 for auth endpoints, not for general API calls
    if (statusCode === 401 && error.config?.url?.includes('/auth/')) {
      localStorage.removeItem('accessToken');
      // Dispatch event to clear user in AuthContext if needed
      window.dispatchEvent(new Event('auth:logout'));
    }
    if (statusCode === 429) {
      console.error('Rate limit reached - Too many requests.');
    }

    return Promise.reject({ message, statusCode, errors });
  }
);

// Unified Exports
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout').finally(() => localStorage.removeItem('accessToken'))
};

export const booksAPI = { 
  getAll: (params) => api.get('/books', { params }),
  getById: (id) => api.get(`/books/${id}`),
  create: (data) => api.post('/books', data),
  update: (id, data) => api.put(`/books/${id}`, data),
  delete: (id) => api.delete(`/books/${id}`)
};
export const libraryCardsAPI = { 
  apply: (data) => api.post('/library-cards/apply', data), 
  getMyCard: () => api.get('/library-cards/my-card'), 
  getAll: (params) => api.get('/library-cards', { params }),
  approve: (id) => api.patch(`/library-cards/${id}/approve`),
  reject: (id, reason) => api.patch(`/library-cards/${id}/reject`, { reason })
};
export const issuesAPI = { 
  getAll: (params) => api.get('/issues', { params }),
  getById: (id) => api.get(`/issues/${id}`),
  issueBook: (data) => api.post('/issues/issue', data), 
  returnBook: (data) => api.post('/issues/return', data),
  renew: (id) => api.post(`/issues/${id}/renew`)
};
export const finesAPI = { 
  getAll: (params) => api.get('/fines', { params }), 
  getMyFines: () => api.get('/fines/my-fines'),
  getById: (id) => api.get(`/fines/${id}`),
  pay: (id, data) => api.patch(`/fines/${id}/pay`, data),
  waive: (id, reason) => api.patch(`/fines/${id}/waive`, { reason }),
  sendReminders: () => api.post('/fines/send-reminders')
};

export default api;
