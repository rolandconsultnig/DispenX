export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string;
  organization?: { id: string; name: string };
}

export interface Organization {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  creditLimit: number;
  settlementCycleDays: number;
  _count?: { employees: number; settlements: number };
}

export interface Employee {
  id: string;
  organizationId: string;
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
  cardStatus: 'ACTIVE' | 'BLOCKED' | 'LOST' | 'EXPIRED';
  createdAt: string;
  organization?: { id: string; name: string };
}

export interface Station {
  id: string;
  stationCode: string;
  name: string;
  location?: string;
  address?: string;
  phone?: string;
  pumpPriceNairaPerLiter: number;
  pricePms: number;
  priceAgo: number;
  priceCng: number;
  apiKey?: string;
  isActive: boolean;
  _count?: { transactions: number };
}

export interface StationAttendantRow {
  id: string;
  username: string;
  displayName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Transaction {
  id: string;
  idempotencyKey: string;
  employeeId: string;
  stationId: string;
  amountLiters: number;
  amountNaira: number;
  pumpPriceAtTime: number;
  quotaType: 'NAIRA' | 'LITERS';
  fuelType: 'PMS' | 'AGO' | 'CNG';
  syncStatus: string;
  transactedAt: string;
  employee?: { id: string; firstName: string; lastName: string; staffId: string };
  station?: { id: string; name: string };
}

export interface Settlement {
  id: string;
  stationId: string;
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  totalLiters: number;
  totalNairaDeducted: number;
  transactionCount: number;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'SETTLED' | 'DISPUTED';
  paidAt?: string;
  notes?: string;
  station?: { id: string; name: string };
  organization?: { id: string; name: string };
}

export interface DashboardData {
  totalEmployees: number;
  activeCards: number;
  blockedCards: number;
  totalStations: number;
  monthlyTransactions: number;
  monthlyVolume: { naira: number; liters: number };
  pendingSettlements: number;
  recentTransactions: Transaction[];
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
