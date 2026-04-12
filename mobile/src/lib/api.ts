import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Base URL for all REST calls. Paths in this app are like `/mobile/login`, so the full
 * URL is `${API_BASE}/mobile/login` → e.g. `http://HOST:PORT/api/mobile/login`.
 *
 * Ports (repo standard): API 4601, admin 4602, staff 4603, station 4604.
 * Use `/api` on 4601 for direct API, or on 4602/4603 when nginx proxies to the API.
 *
 * Override: create `mobile/.env` — see `mobile/.env.example`.
 *
 * Android emulator → dev machine API: http://10.0.2.2:4601/api
 */
const rawApiBase =
  process.env.EXPO_PUBLIC_API_BASE?.replace(/\/$/, '') || 'http://localhost:4601/api';

if (!__DEV__ && /localhost|127\.0\.0\.1/.test(rawApiBase)) {
  console.warn(
    '[EnergyDispenX] EXPO_PUBLIC_API_BASE is localhost in a release build. ' +
      'Create mobile/.env with your server URL (see mobile/.env.example) and rebuild.'
  );
}

const API_BASE = rawApiBase;

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
