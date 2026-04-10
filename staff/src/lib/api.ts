import axios from 'axios';

const api = axios.create({
  baseURL: '/api/mobile',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cfms_staff_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    const status = error.response?.status;
    const url = String(error.config?.url ?? '');
    const method = String(error.config?.method ?? '').toLowerCase();
    // Failed staff ID / PIN must not clear session or hard-redirect (breaks toast + can race with success).
    const isCredentialLoginFailure =
      status === 401 && method === 'post' && (url.endsWith('/login') || url.includes('/login'));
    if (status === 401 && !isCredentialLoginFailure) {
      localStorage.removeItem('cfms_staff_token');
      localStorage.removeItem('cfms_staff_employee');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
