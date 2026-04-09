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
    if (error.response?.status === 401) {
      localStorage.removeItem('cfms_staff_token');
      localStorage.removeItem('cfms_staff_employee');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
