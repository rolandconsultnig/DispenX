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
  allotmentCategory?: string | null;
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

export interface SiphoningAlert {
  id: string;
  organizationId: string;
  employeeId: string;
  vehicleId: string;
  transactionId: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'FALSE_POSITIVE';
  reason: string;
  dispensedLiters: number;
  observedFuelLevelDeltaPct: number;
  expectedFuelLevelDeltaPct: number;
  suspectedSiphonedLiters: number;
  confidenceScore: number;
  reviewNote?: string;
  reviewedAt?: string;
  reviewedBy?: { id: string; firstName?: string; lastName?: string; email?: string } | null;
  createdAt: string;
  employee?: {
    staffId: string;
    firstName: string;
    lastName: string;
    organization?: { name: string };
  };
  vehicle?: { plateNumber: string; make?: string; model?: string };
  transaction?: {
    transactedAt: string;
    amountLiters: number;
    amountNaira: number;
    fuelType: 'PMS' | 'AGO' | 'CNG';
    station?: { name: string };
  };
}

export interface FraudCase {
  id: string;
  organizationId: string;
  employeeId: string | null;
  vehicleId: string | null;
  transactionId: string | null;
  category: string;
  title: string;
  description: string;
  severity: number;
  riskScore: number | null;
  status: 'OPEN' | 'UNDER_REVIEW' | 'CONFIRMED' | 'DISMISSED';
  detectedAt: string;
  reportedByUserId: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  resolutionNote: string | null;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
  employee?: { id: string; staffId: string; firstName: string; lastName: string } | null;
  vehicle?: { id: string; plateNumber: string } | null;
  transaction?: {
    id: string;
    transactedAt: string;
    amountLiters: number;
    amountNaira: number;
  } | null;
  reportedBy?: { id: string; firstName?: string; lastName?: string } | null;
  reviewedBy?: { id: string; firstName?: string; lastName?: string } | null;
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
