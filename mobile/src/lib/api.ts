import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getEnvApiBase, loadStoredApiBase } from './serverConfig';

export const ACCESS_TOKEN_KEY = 'cfms_mobile_token';
export const REFRESH_TOKEN_KEY = 'cfms_mobile_refresh_token';
export const EMPLOYEE_CACHE_KEY = 'cfms_mobile_employee';

let refreshPromise: Promise<string | null> | null = null;

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
  const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

async function performTokenRefresh(): Promise<string | null> {
  const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    return null;
  }

  try {
    const res = await axios.post(
      `${getApiBaseUrl()}/mobile/auth/refresh`,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    );

    const nextAccessToken: string | undefined = res?.data?.data?.token;
    const nextRefreshToken: string | undefined = res?.data?.data?.refreshToken;
    if (!nextAccessToken || !nextRefreshToken) {
      return null;
    }

    await AsyncStorage.multiSet([
      [ACCESS_TOKEN_KEY, nextAccessToken],
      [REFRESH_TOKEN_KEY, nextRefreshToken],
    ]);
    return nextAccessToken;
  } catch {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, EMPLOYEE_CACHE_KEY]);
    return null;
  }
}

async function getRefreshedAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = performTokenRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config;
    const requestUrl = String(originalRequest?.url || '');
    const isAuthEndpoint = requestUrl.includes('/mobile/login') || requestUrl.includes('/mobile/auth/refresh');

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      const nextAccessToken = await getRefreshedAccessToken();
      if (nextAccessToken) {
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
        return api(originalRequest);
      }

      await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, EMPLOYEE_CACHE_KEY]);
    }

    return Promise.reject(error);
  }
);

export default api;
