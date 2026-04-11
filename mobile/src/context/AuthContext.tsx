import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';

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
  cardStatus: string;
  organization?: { id: string; name: string };
}

interface AuthContextType {
  employee: Employee | null;
  loading: boolean;
  needsPin: boolean;
  login: (staffId: string, organizationId: string, pin: string) => Promise<void>;
  setupPin: (staffId: string, organizationId: string, phone: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPin, setNeedsPin] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('cfms_mobile_token');
        if (token) {
          const res = await api.get('/mobile/me');
          setEmployee(res.data.data);
        }
      } catch {
        await AsyncStorage.multiRemove(['cfms_mobile_token', 'cfms_mobile_employee']);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (staffId: string, organizationId: string, pin: string) => {
    const res = await api.post('/mobile/login', { staffId, organizationId, pin });
    await AsyncStorage.setItem('cfms_mobile_token', res.data.data.token);
    setEmployee(res.data.data.employee);
    setNeedsPin(false);
  };

  const setupPin = async (staffId: string, organizationId: string, phone: string, pin: string) => {
    const res = await api.post('/mobile/setup-pin', { staffId, organizationId, phone, pin });
    await AsyncStorage.setItem('cfms_mobile_token', res.data.data.token);
    setEmployee(res.data.data.employee);
    setNeedsPin(false);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['cfms_mobile_token', 'cfms_mobile_employee']);
    setEmployee(null);
  };

  const refreshProfile = useCallback(async () => {
    try {
      const res = await api.get('/mobile/me');
      setEmployee(res.data.data);
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
