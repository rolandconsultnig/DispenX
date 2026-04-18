import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import api, { ACCESS_TOKEN_KEY, EMPLOYEE_CACHE_KEY, REFRESH_TOKEN_KEY } from '../lib/api';
import { processOfflineQueue } from '../lib/offlineQueue';

interface Employee {
  id: string;
  staffId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  rfidUid?: string;
  quotaType: 'NAIRA' | 'LITERS';
  quotaLiters: number;
  quotaNaira: number;
  balanceLiters: number;
  balanceNaira: number;
  fuelType: 'PMS' | 'AGO' | 'CNG';
  allotmentCategory?: string | null;
  cardStatus: string;
  organization?: { id: string; name: string };
}

interface AuthContextType {
  employee: Employee | null;
  loading: boolean;
  needsPin: boolean;
  login: (staffId: string, organizationId: string, pin: string) => Promise<void>;
  setupPin: (staffId: string, organizationId: string, phone: string, pin: string) => Promise<void>;
  logout: (allDevices?: boolean) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPin, setNeedsPin] = useState(false);

  const getDeviceMeta = useCallback(async () => {
    const key = 'cfms_mobile_device_id';
    let deviceId = await AsyncStorage.getItem(key);
    if (!deviceId) {
      deviceId = `${Platform.OS}-${Date.now()}-${Math.floor(Math.random() * 1_000_000_000)}`;
      await AsyncStorage.setItem(key, deviceId);
    }

    return {
      deviceId,
      deviceName: `${Platform.OS.toUpperCase()} Device`,
      platform: Platform.OS,
      appVersion: '1.0.0',
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('cfms_mobile_token');
        if (token) {
          const res = await api.get('/mobile/me');
          setEmployee(res.data.data);
        }
      } catch {
        await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, EMPLOYEE_CACHE_KEY]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (staffId: string, organizationId: string, pin: string) => {
    const deviceMeta = await getDeviceMeta();
    const res = await api.post('/mobile/login', { staffId, organizationId, pin, ...deviceMeta });

    const accessToken = res.data?.data?.token;
    const refreshToken = res.data?.data?.refreshToken;
    if (accessToken) {
      await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    }
    if (refreshToken) {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }

    setEmployee(res.data.data.employee);
    await processOfflineQueue();
    setNeedsPin(false);
  };

  const setupPin = async (staffId: string, organizationId: string, phone: string, pin: string) => {
    await api.post('/mobile/setup-pin', { staffId, organizationId, phone, newPin: pin });
    await login(staffId, organizationId, pin);
  };

  const logout = async (allDevices = false) => {
    try {
      await api.post('/mobile/auth/logout', { allDevices });
    } catch {
      /* clear local state regardless */
    }
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, EMPLOYEE_CACHE_KEY]);
    setEmployee(null);
  };

  const refreshProfile = useCallback(async () => {
    try {
      const res = await api.get('/mobile/me');
      setEmployee(res.data.data);
      await processOfflineQueue();
    } catch {
      /* keep last known profile */
    }
  }, []);

  return (
    <AuthContext.Provider value={{ employee, loading, needsPin, login, setupPin, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
