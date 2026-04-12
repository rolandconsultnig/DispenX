import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getEnvApiBase, loadStoredApiBase } from './serverConfig';

/**
 * Base URL for all REST calls. Paths are like `/mobile/login` → `${base}/mobile/login`.
 * Override at runtime: hidden server settings (stored in AsyncStorage), or `EXPO_PUBLIC_API_BASE` at build time.
 */
if (!__DEV__ && /localhost|127\.0\.0\.1/.test(getEnvApiBase())) {
  console.warn(
    '[EnergyDispenX] EXPO_PUBLIC_API_BASE is localhost in a release build. ' +
      'Use hidden server settings (long-press subtitle on login) or rebuild with .env.'
  );
}

const api = axios.create({
  baseURL: getEnvApiBase().replace(/\/$/, ''),
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

export async function hydrateApiBaseUrl(): Promise<string> {
  const stored = await loadStoredApiBase();
  const base = (stored ?? getEnvApiBase()).replace(/\/$/, '');
  api.defaults.baseURL = base;
  return base;
}

export function getApiBaseUrl(): string {
  return (api.defaults.baseURL || '').replace(/\/$/, '');
}

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
