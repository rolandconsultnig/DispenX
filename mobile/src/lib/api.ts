import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Base URL for all REST calls. Paths in this app are like `/mobile/login`, so the full
 * URL is `${API_BASE}/mobile/login` → e.g. `http://HOST:PORT/api/mobile/login`.
 *
 * Production default: your EC2 host with whatever port exposes `/api` (often nginx → Node :4000).
 * If only port 4602 is open, ensure nginx proxies `/api` to the API (same as Vite dev).
 *
 * Override: create `mobile/.env` with:
 *   EXPO_PUBLIC_API_BASE=http://13.53.33.63:4602/api
 *
 * Android emulator → host machine: http://10.0.2.2:4000/api
 */
const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE?.replace(/\/$/, '') || 'http://13.53.33.63:4602/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('cfms_mobile_token');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove(['cfms_mobile_token', 'cfms_mobile_employee']);
    }
    return Promise.reject(error);
  }
);

export default api;
