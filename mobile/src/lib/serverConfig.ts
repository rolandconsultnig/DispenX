import AsyncStorage from '@react-native-async-storage/async-storage';

/** Typed on the login / profile screen; opens server IP & port settings. */
export const SECRET_SERVER_UNLOCK_SEQUENCE = '*2435*00#';

const STORAGE_KEY = 'cfms_mobile_api_base_override';

const DEFAULT_PATH = 'api';

export function getEnvApiBase(): string {
  const raw = process.env.EXPO_PUBLIC_API_BASE?.replace(/\/$/, '') || 'http://localhost:4601/api';
  return raw;
}

export async function loadStoredApiBase(): Promise<string | null> {
  const v = await AsyncStorage.getItem(STORAGE_KEY);
  return v?.trim() ? v.trim().replace(/\/$/, '') : null;
}

export async function saveStoredApiBase(url: string | null): Promise<void> {
  if (!url?.trim()) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, url.trim().replace(/\/$/, ''));
}

export type ParsedApiBase = {
  host: string;
  port: string;
  secure: boolean;
};

/** Parse `http(s)://host:port/api/...` into host/port for the form. */
export function parseApiBaseForForm(base: string): ParsedApiBase {
  const normalized = base.trim().replace(/\/$/, '');
  try {
    const u = new URL(normalized.includes('://') ? normalized : `http://${normalized}`);
    const secure = u.protocol === 'https:';
    const port =
      u.port ||
      (secure ? '443' : u.protocol === 'http:' ? '80' : '');
    return { host: u.hostname, port, secure };
  } catch {
    return { host: '', port: '4601', secure: false };
  }
}

export function buildApiBaseUrl(host: string, port: string, secure: boolean, pathSegment: string = DEFAULT_PATH): string {
  const h = host.trim();
  const p = port.trim();
  if (!h) throw new Error('Host is required');
  const portNum = parseInt(p, 10);
  if (!Number.isFinite(portNum) || portNum < 1 || portNum > 65535) {
    throw new Error('Port must be between 1 and 65535');
  }
  const path = pathSegment.replace(/^\/+/, '').replace(/\/+$/, '') || DEFAULT_PATH;
  const scheme = secure ? 'https' : 'http';
  return `${scheme}://${h}:${portNum}/${path}`;
}
