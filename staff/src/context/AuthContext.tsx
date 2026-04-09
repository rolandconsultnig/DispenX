import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../lib/api';

interface Employee {
  id: string; staffId: string; firstName: string; lastName: string;
  phone?: string; email?: string; rfidUid?: string;
  quotaType: string; quotaNaira: number; quotaLiters: number;
  balanceNaira: number; balanceLiters: number; cardStatus: string;
  fuelType: string;
  organization?: { id: string; name: string };
}

interface AuthCtx {
  employee: Employee | null;
  loading: boolean;
  login: (staffId: string, pin: string, organizationId?: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({} as AuthCtx);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('cfms_staff_employee');
    const token = localStorage.getItem('cfms_staff_token');
    if (stored && token) {
      setEmployee(JSON.parse(stored));
      refresh().finally(() => setLoading(false));
    } else { setLoading(false); }
  }, []);

  async function login(staffId: string, pin: string, organizationId?: string) {
    const body: any = { staffId, pin };
    if (organizationId) body.organizationId = organizationId;
    const { data } = await api.post('/login', body);
    localStorage.setItem('cfms_staff_token', data.data.token);
    localStorage.setItem('cfms_staff_employee', JSON.stringify(data.data.employee));
    setEmployee(data.data.employee);
  }

  async function refresh() {
    try {
      const { data } = await api.get('/me');
      setEmployee(data.data);
      localStorage.setItem('cfms_staff_employee', JSON.stringify(data.data));
    } catch { /* token expired */ }
  }

  function logout() {
    localStorage.removeItem('cfms_staff_token');
    localStorage.removeItem('cfms_staff_employee');
    setEmployee(null);
  }

  return <Ctx.Provider value={{ employee, loading, login, logout, refresh }}>{children}</Ctx.Provider>;
}
