import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightLeft,
  Banknote,
  BarChart3,
  BatteryCharging,
  Building2,
  CircleUser,
  Download,
  FileSpreadsheet,
  Landmark,
  Loader2,
  PiggyBank,
  Receipt,
  Scale,
  Search,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

type FinanceOverview = {
  scope: 'all' | 'organization';
  periodLabel: string;
  wallet: {
    totalBalanceNaira: number;
    totalBalanceLiters: number;
    activeCards: number;
  };
  settlements: {
    byStatus: Array<{
      status: string;
      count: number;
      totalNaira: number;
      totalLiters: number;
    }>;
    outstanding: { count: number; totalNaira: number; totalLiters: number };
  };
  monthToDate: {
    transactions: { count: number; amountNaira: number; amountLiters: number };
    recharges: { count: number; amountNaira: number; amountLiters: number };
  };
  organizations: Array<{
    id: string;
    name: string;
    creditLimit: number;
    settlementCycleDays: number;
  }>;
  pipeline: {
    pendingQuotaRequests: number;
    openDisputes: number;
  };
};

type MeResponse = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string;
  organization?: { id: string; name: string };
};

type LedgerKind = 'transactions' | 'recharges' | 'settlements';
type LedgerResponse = {
  kind: 'TRANSACTION' | 'RECHARGE' | 'SETTLEMENT';
  id: string;
  occurredAt: string;
  amountNaira?: number;
  amountLiters?: number;
  fuelType?: string;
  source?: string;
  quotaType?: string;
  rechargeType?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  notes?: string | null;
  employee?: any;
  station?: any;
  organization?: any;
  performedBy?: any;
  periodStart?: string;
  periodEnd?: string;
  status?: string;
  transactionCount?: number;
  invoicePdfUrl?: string | null;
  paidAt?: string | null;
  paymentSummary?: {
    paymentCount: number;
    totalPaidNaira: number;
    totalPaidLiters: number;
    latestPayment?: {
      id: string;
      amountNaira?: number;
      amountLiters?: number;
      paymentDate?: string;
      paymentReference?: string;
      paymentChannel?: string;
      statusAfterPayment?: string;
    } | null;
  };
};

type ReconciliationData = {
  period: { from: string; to: string };
  transactions: { count: number; amountNaira: number; amountLiters: number };
  recharges: { count: number; amountNaira: number; amountLiters: number };
  settlementPayments: { count: number; amountNaira: number; amountLiters: number };
  settlementsByStatus: Array<{ status: string; count: number; amountNaira: number; amountLiters: number }>;
  pendingExposureAgingNaira: { current: number; due7: number; due30: number; overdue30: number };
};

const quickLinks = [
  {
    to: '/settlements',
    label: 'Station settlements',
    description: 'Generate cycles, mark paid, dispute handling',
    icon: Receipt,
    tone: 'bg-violet-500',
  },
  {
    to: '/recharge',
    label: 'Wallet recharge',
    description: 'Bulk top-ups and quota allocations',
    icon: BatteryCharging,
    tone: 'bg-emerald-500',
  },
  {
    to: '/transactions',
    label: 'Transactions',
    description: 'Drill into line-by-line fuel spend',
    icon: ArrowRightLeft,
    tone: 'bg-sky-500',
  },
  {
    to: '/reporting',
    label: 'Reporting & exports',
    description: 'Executive KPIs and CSV exports',
    icon: BarChart3,
    tone: 'bg-indigo-500',
  },
  {
    to: '/organizations',
    label: 'Organizations',
    description: 'Credit limits and settlement cycles',
    icon: Building2,
    tone: 'bg-slate-600',
  },
];

export default function FinancePage() {
  const { user: authUser } = useAuth();
  const [tab, setTab] = useState<'overview' | 'accounting' | 'account'>('overview');
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingMe, setLoadingMe] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ledgerKind, setLedgerKind] = useState<LedgerKind>('transactions');
  const [ledgerRows, setLedgerRows] = useState<LedgerResponse[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);
  const [ledgerLimit, setLedgerLimit] = useState(25);
  const [ledgerFrom, setLedgerFrom] = useState('');
  const [ledgerTo, setLedgerTo] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [reconciliation, setReconciliation] = useState<ReconciliationData | null>(null);
  const [reconLoading, setReconLoading] = useState(false);
  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    settlementId?: string;
    status: 'SETTLED' | 'PARTIALLY_PAID' | 'DISPUTED';
    paymentReference: string;
    paymentChannel: string;
    paymentDate: string;
    amountNaira: string;
    amountLiters: string;
    evidenceUrl: string;
    note: string;
  }>({
    open: false,
    status: 'SETTLED',
    paymentReference: '',
    paymentChannel: '',
    paymentDate: '',
    amountNaira: '',
    amountLiters: '',
    evidenceUrl: '',
    note: '',
  });
  const [savingPayment, setSavingPayment] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    setError(null);
    try {
      const res = await api.get('/finance/overview');
      setOverview(res.data?.data ?? null);
    } catch {
      setOverview(null);
      setError('Could not load finance overview. Check your permissions or try again.');
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const loadMe = useCallback(async () => {
    setLoadingMe(true);
    try {
      const res = await api.get('/auth/me');
      setMe(res.data?.data ?? null);
    } catch {
      setMe(null);
    } finally {
      setLoadingMe(false);
    }
  }, []);

  const loadLedger = useCallback(async () => {
    setLedgerLoading(true);
    try {
      const p = new URLSearchParams();
      p.set('kind', ledgerKind);
      p.set('page', String(ledgerPage));
      p.set('limit', String(ledgerLimit));
      if (ledgerFrom) p.set('from', ledgerFrom);
      if (ledgerTo) p.set('to', ledgerTo);
      if (ledgerSearch.trim()) p.set('search', ledgerSearch.trim());
      const res = await api.get(`/finance/ledger?${p.toString()}`);
      setLedgerRows(Array.isArray(res.data?.data) ? res.data.data : []);
      const meta = res.data?.meta;
      setLedgerTotalPages(Math.max(1, meta?.totalPages || 1));
    } catch {
      setLedgerRows([]);
      setLedgerTotalPages(1);
    } finally {
      setLedgerLoading(false);
    }
  }, [ledgerFrom, ledgerKind, ledgerLimit, ledgerPage, ledgerSearch, ledgerTo]);

  const loadReconciliation = useCallback(async () => {
    setReconLoading(true);
    try {
      const p = new URLSearchParams();
      if (ledgerFrom) p.set('from', ledgerFrom);
      if (ledgerTo) p.set('to', ledgerTo);
      const res = await api.get(`/finance/reconciliation?${p.toString()}`);
      setReconciliation(res.data?.data ?? null);
    } catch {
      setReconciliation(null);
    } finally {
      setReconLoading(false);
    }
  }, [ledgerFrom, ledgerTo]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (tab === 'account') void loadMe();
  }, [tab, loadMe]);

  useEffect(() => {
    if (tab === 'accounting') void loadLedger();
  }, [tab, loadLedger]);

  useEffect(() => {
    if (tab === 'accounting' || tab === 'overview') void loadReconciliation();
  }, [tab, loadReconciliation]);

  const fmtMoney = (n: number) => `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const fmtLiters = (n: number) => `${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} L`;

  function exportLedgerCsv() {
    if (!ledgerRows.length) return;
    const headers = [
      'Kind',
      'OccurredAt',
      'AmountNaira',
      'AmountLiters',
      'StaffId',
      'Employee',
      'Organization',
      'Station',
      'Status',
      'Notes',
      'TotalPaidNaira',
      'LatestPaymentReference',
    ];
    const rows = ledgerRows.map((r) => [
      r.kind,
      new Date(r.occurredAt).toISOString(),
      String(r.amountNaira ?? ''),
      String(r.amountLiters ?? ''),
      r.employee?.staffId ?? '',
      r.employee ? `${r.employee.firstName ?? ''} ${r.employee.lastName ?? ''}`.trim() : '',
      r.organization?.name ?? r.employee?.organization?.name ?? '',
      r.station?.name ?? '',
      r.status ?? '',
      r.notes ?? '',
      String(r.paymentSummary?.totalPaidNaira ?? ''),
      r.paymentSummary?.latestPayment?.paymentReference ?? '',
    ]);
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-ledger-${ledgerKind}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function submitSettlementPayment() {
    if (!paymentModal.settlementId) return;
    setSavingPayment(true);
    try {
      await api.post(`/finance/settlements/${paymentModal.settlementId}/payment`, {
        status: paymentModal.status,
        amountNaira: paymentModal.amountNaira ? Number(paymentModal.amountNaira) : undefined,
        amountLiters: paymentModal.amountLiters ? Number(paymentModal.amountLiters) : undefined,
        paymentReference: paymentModal.paymentReference || undefined,
        paymentChannel: paymentModal.paymentChannel || undefined,
        paymentDate: paymentModal.paymentDate || undefined,
        evidenceUrl: paymentModal.evidenceUrl || undefined,
        note: paymentModal.note || undefined,
      });
      setPaymentModal({
        open: false,
        status: 'SETTLED',
        paymentReference: '',
        paymentChannel: '',
        paymentDate: '',
        amountNaira: '',
        amountLiters: '',
        evidenceUrl: '',
        note: '',
      });
      await Promise.all([loadLedger(), loadOverview(), loadReconciliation()]);
    } finally {
      setSavingPayment(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-900 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
              <Landmark className="h-8 w-8 text-emerald-200" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-100/90">Finance & account</p>
              <h1 className="mt-1 text-2xl font-bold">Financial control center</h1>
              <p className="mt-2 max-w-xl text-sm text-slate-200">
                Unified view of prepaid wallet float, station settlement exposure, and month-to-date movement. Switch to
                <span className="font-medium text-white"> My account</span> for your portal profile.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTab('overview')}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                tab === 'overview' ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setTab('accounting')}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                tab === 'accounting' ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Accounting
            </button>
            <button
              type="button"
              onClick={() => setTab('account')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                tab === 'account' ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <CircleUser className="h-4 w-4" />
              My account
            </button>
          </div>
        </div>
      </section>

      {tab === 'overview' && (
        <>
          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {error}
            </div>
          )}

          {loadingOverview && !overview ? (
            <div className="flex justify-center py-20 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : overview ? (
            <>
              <p className="text-center text-xs text-slate-500">
                Showing {overview.scope === 'all' ? 'all organizations' : 'your organization'} · {overview.periodLabel}
              </p>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi
                  icon={PiggyBank}
                  label="Prepaid wallet (₦)"
                  value={fmtMoney(overview.wallet.totalBalanceNaira)}
                  sub={`${overview.wallet.activeCards.toLocaleString()} active cards`}
                  ring="bg-emerald-500"
                />
                <Kpi
                  icon={Banknote}
                  label="Prepaid wallet (liters)"
                  value={fmtLiters(overview.wallet.totalBalanceLiters)}
                  sub="Across staff with liter quota"
                  ring="bg-cyan-500"
                />
                <Kpi
                  icon={Scale}
                  label="Settlement exposure (outstanding)"
                  value={fmtMoney(overview.settlements.outstanding.totalNaira)}
                  sub={`${overview.settlements.outstanding.count} open periods · ${fmtLiters(overview.settlements.outstanding.totalLiters)}`}
                  ring="bg-amber-500"
                />
                <Kpi
                  icon={TrendingUp}
                  label="MTD fuel spend"
                  value={fmtMoney(overview.monthToDate.transactions.amountNaira)}
                  sub={`${overview.monthToDate.transactions.count.toLocaleString()} transactions · ${fmtLiters(overview.monthToDate.transactions.amountLiters)}`}
                  ring="bg-indigo-500"
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">Month-to-date top-ups</h2>
                  <p className="text-xs text-slate-500">Logged recharges and allocations</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-slate-500">Count</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {overview.monthToDate.recharges.count.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-slate-500">Value (₦)</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {fmtMoney(overview.monthToDate.recharges.amountNaira)}
                      </p>
                    </div>
                    <div className="col-span-2 rounded-xl bg-slate-50 p-3">
                      <p className="text-slate-500">Liters credited</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {fmtLiters(overview.monthToDate.recharges.amountLiters)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">Action queue</h2>
                  <p className="text-xs text-slate-500">Items that often need finance or fleet follow-up</p>
                  <ul className="mt-4 space-y-2 text-sm">
                    <li className="flex justify-between rounded-lg border border-slate-100 px-3 py-2">
                      <span className="text-slate-600">Pending quota requests</span>
                      <span className="font-semibold text-slate-900">
                        {overview.pipeline.pendingQuotaRequests.toLocaleString()}
                      </span>
                    </li>
                    <li className="flex justify-between rounded-lg border border-slate-100 px-3 py-2">
                      <span className="text-slate-600">Open / in-review disputes</span>
                      <span className="font-semibold text-slate-900">{overview.pipeline.openDisputes.toLocaleString()}</span>
                    </li>
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      to="/fleet-management"
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      Open fleet tools
                    </Link>
                    <button
                      type="button"
                      onClick={() => void loadOverview()}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Refresh figures
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Settlements by status</h2>
                <p className="text-xs text-slate-500">Station invoice pipeline (amounts reflect recorded settlement periods)</p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-slate-500">
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2 pr-4">Periods</th>
                        <th className="pb-2 pr-4">Total (₦)</th>
                        <th className="pb-2">Total (L)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.settlements.byStatus.map((row) => (
                        <tr key={row.status} className="border-b border-slate-50">
                          <td className="py-2 pr-4 font-medium text-slate-800">{row.status.replace(/_/g, ' ')}</td>
                          <td className="py-2 pr-4">{row.count.toLocaleString()}</td>
                          <td className="py-2 pr-4">{fmtMoney(row.totalNaira)}</td>
                          <td className="py-2">{fmtLiters(row.totalLiters)}</td>
                        </tr>
                      ))}
                      {overview.settlements.byStatus.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400">
                            No settlement periods yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {overview.organizations.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">Credit & billing parameters</h2>
                  <p className="text-xs text-slate-500">
                    Organizational credit ceiling and settlement rhythm (edit under Organizations).
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {overview.organizations.map((org) => (
                      <div key={org.id} className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                        <p className="font-medium text-slate-900">{org.name}</p>
                        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
                          <span>
                            Credit limit: <strong className="text-slate-900">{fmtMoney(org.creditLimit)}</strong>
                          </span>
                          <span>
                            Settlement cycle:{' '}
                            <strong className="text-slate-900">{org.settlementCycleDays} days</strong>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Quick navigation</h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {quickLinks.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="group flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
                    >
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${item.tone}`}
                      >
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 group-hover:text-indigo-600">{item.label}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </>
      )}

      {tab === 'accounting' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Accounting module</h2>
                <p className="text-xs text-slate-500">
                  Ledger, reconciliation, and settlement payment capture in one place.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={ledgerKind}
                  onChange={(e) => {
                    setLedgerKind(e.target.value as LedgerKind);
                    setLedgerPage(1);
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="transactions">Transactions</option>
                  <option value="recharges">Recharges</option>
                  <option value="settlements">Settlements</option>
                </select>
                <input
                  type="date"
                  value={ledgerFrom}
                  onChange={(e) => {
                    setLedgerFrom(e.target.value);
                    setLedgerPage(1);
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={ledgerTo}
                  onChange={(e) => {
                    setLedgerTo(e.target.value);
                    setLedgerPage(1);
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    placeholder="Search staff, station, notes..."
                    className="w-[280px] rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void loadLedger()}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  disabled={!ledgerRows.length}
                  onClick={exportLedgerCsv}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ReconCard
              label="Fuel spend"
              value={reconciliation ? fmtMoney(reconciliation.transactions.amountNaira) : '—'}
              sub={reconciliation ? `${reconciliation.transactions.count.toLocaleString()} txns` : 'Loading...'}
              loading={reconLoading}
            />
            <ReconCard
              label="Recharge credits"
              value={reconciliation ? fmtMoney(reconciliation.recharges.amountNaira) : '—'}
              sub={reconciliation ? `${reconciliation.recharges.count.toLocaleString()} events` : 'Loading...'}
              loading={reconLoading}
            />
            <ReconCard
              label="Settlement payments"
              value={reconciliation ? fmtMoney(reconciliation.settlementPayments.amountNaira) : '—'}
              sub={reconciliation ? `${reconciliation.settlementPayments.count.toLocaleString()} payment events` : 'Loading...'}
              loading={reconLoading}
            />
            <ReconCard
              label="Pending exposure (0-30d)"
              value={
                reconciliation
                  ? fmtMoney(
                      (reconciliation.pendingExposureAgingNaira.current || 0) +
                        (reconciliation.pendingExposureAgingNaira.due7 || 0) +
                        (reconciliation.pendingExposureAgingNaira.due30 || 0)
                    )
                  : '—'
              }
              sub="Current + due buckets"
              loading={reconLoading}
            />
            <ReconCard label="Overdue >60d" value={reconciliation ? fmtMoney(reconciliation.pendingExposureAgingNaira.overdue30 || 0) : '—'} sub="Aging watchlist" loading={reconLoading} />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {ledgerLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              </div>
            ) : ledgerRows.length === 0 ? (
              <p className="p-10 text-center text-sm text-slate-500">No ledger rows for this filter.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs font-medium text-slate-500">
                      <th className="px-4 py-3">When</th>
                      <th className="px-4 py-3">Kind</th>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Org</th>
                      <th className="px-4 py-3">Station</th>
                      <th className="px-4 py-3">₦</th>
                      <th className="px-4 py-3">L</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Notes / Payment</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerRows.map((r) => (
                      <tr key={`${r.kind}-${r.id}`} className="border-b border-slate-100 hover:bg-slate-50/70">
                        <td className="px-4 py-3 text-slate-600">{new Date(r.occurredAt).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                            {r.kind}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">
                            {r.employee ? `${r.employee.firstName ?? ''} ${r.employee.lastName ?? ''}`.trim() : '—'}
                          </p>
                          <p className="text-xs text-slate-500">{r.employee?.staffId ?? ''}</p>
                        </td>
                        <td className="px-4 py-3">{r.organization?.name ?? r.employee?.organization?.name ?? '—'}</td>
                        <td className="px-4 py-3">{r.station?.name ?? '—'}</td>
                        <td className="px-4 py-3 font-medium">{r.amountNaira != null ? fmtMoney(r.amountNaira) : '—'}</td>
                        <td className="px-4 py-3">{r.amountLiters != null ? fmtLiters(r.amountLiters) : '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{r.status ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          <p>{r.notes || '—'}</p>
                          {r.paymentSummary?.latestPayment && (
                            <p className="mt-1 text-[11px] text-slate-400">
                              Last payment: {fmtMoney(r.paymentSummary.latestPayment.amountNaira || 0)} ·{' '}
                              {r.paymentSummary.latestPayment.paymentReference || 'no ref'}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {r.kind === 'SETTLEMENT' && r.status !== 'SETTLED' ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPaymentModal({
                                  open: true,
                                  settlementId: r.id,
                                  status: 'SETTLED',
                                  paymentReference: '',
                                  paymentChannel: '',
                                  paymentDate: '',
                                  amountNaira: r.amountNaira != null ? String(r.amountNaira) : '',
                                  amountLiters: r.amountLiters != null ? String(r.amountLiters) : '',
                                  evidenceUrl: '',
                                  note: '',
                                })
                              }
                              className="rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                            >
                              Record payment
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={ledgerPage <= 1}
                onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={ledgerPage >= ledgerTotalPages}
                onClick={() => setLedgerPage((p) => Math.min(ledgerTotalPages, p + 1))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
              <span className="text-xs text-slate-500">
                Page <span className="font-semibold text-slate-700">{ledgerPage}</span> of{' '}
                <span className="font-semibold text-slate-700">{ledgerTotalPages}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Rows</span>
              <select
                value={String(ledgerLimit)}
                onChange={(e) => {
                  setLedgerLimit(parseInt(e.target.value, 10));
                  setLedgerPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {tab === 'account' && (
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Portal account</h2>
          <p className="mt-1 text-sm text-slate-500">Signed-in administrator profile (read-only in this view).</p>

          {loadingMe ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : (
            <dl className="mt-6 space-y-4 text-sm">
              <div className="flex justify-between border-b border-slate-100 py-2">
                <dt className="text-slate-500">Name</dt>
                <dd className="font-medium text-slate-900">
                  {(me?.firstName || authUser?.firstName) ?? '—'} {(me?.lastName || authUser?.lastName) ?? ''}
                </dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-2">
                <dt className="text-slate-500">Email</dt>
                <dd className="font-medium text-slate-900">{me?.email ?? authUser?.email ?? '—'}</dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-2">
                <dt className="text-slate-500">Role</dt>
                <dd>
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                    {(me?.role || authUser?.role || '—').replace(/_/g, ' ')}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-2">
                <dt className="text-slate-500">Organization</dt>
                <dd className="max-w-[60%] text-right font-medium text-slate-900">
                  {me?.organization?.name ?? '—'}
                </dd>
              </div>
            </dl>
          )}

          <div className="mt-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-600">
            <p className="flex items-start gap-2">
              <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              Password changes and additional admin users are managed by your organization&rsquo;s super administrator.
              Use <span className="font-medium">Organizations</span> and user provisioning workflows as configured for your
              tenant.
            </p>
          </div>
        </div>
      )}

      {paymentModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Record settlement payment</h3>
            <p className="mt-1 text-sm text-slate-500">
              Capture payment reference, channel, and optional proof link for audit/reconciliation.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <select
                value={paymentModal.status}
                onChange={(e) => setPaymentModal((m) => ({ ...m, status: e.target.value as any }))}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="SETTLED">Settled</option>
                <option value="PARTIALLY_PAID">Partially paid</option>
                <option value="DISPUTED">Disputed</option>
              </select>
              <input
                type="date"
                value={paymentModal.paymentDate}
                onChange={(e) => setPaymentModal((m) => ({ ...m, paymentDate: e.target.value }))}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={paymentModal.amountNaira}
                onChange={(e) => setPaymentModal((m) => ({ ...m, amountNaira: e.target.value }))}
                placeholder="Amount paid (₦)"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min="0"
                step="0.001"
                value={paymentModal.amountLiters}
                onChange={(e) => setPaymentModal((m) => ({ ...m, amountLiters: e.target.value }))}
                placeholder="Liters paid (optional)"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={paymentModal.paymentReference}
                onChange={(e) => setPaymentModal((m) => ({ ...m, paymentReference: e.target.value }))}
                placeholder="Payment reference"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={paymentModal.paymentChannel}
                onChange={(e) => setPaymentModal((m) => ({ ...m, paymentChannel: e.target.value }))}
                placeholder="Channel (bank transfer, card...)"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <input
              value={paymentModal.evidenceUrl}
              onChange={(e) => setPaymentModal((m) => ({ ...m, evidenceUrl: e.target.value }))}
              placeholder="Proof URL (optional)"
              className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <textarea
              value={paymentModal.note}
              onChange={(e) => setPaymentModal((m) => ({ ...m, note: e.target.value }))}
              rows={4}
              placeholder="Note (optional)"
              className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={savingPayment}
                onClick={() =>
                  setPaymentModal({
                    open: false,
                    status: 'SETTLED',
                    paymentReference: '',
                    paymentChannel: '',
                    paymentDate: '',
                    amountNaira: '',
                    amountLiters: '',
                    evidenceUrl: '',
                    note: '',
                  })
                }
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingPayment}
                onClick={() => void submitSettlementPayment()}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {savingPayment ? 'Saving...' : 'Save payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  ring,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  ring: string;
}) {
  return (
    <div className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white ${ring}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="truncate text-lg font-bold text-slate-900">{value}</p>
        <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
      </div>
    </div>
  );
}

function ReconCard({
  label,
  value,
  sub,
  loading,
}: {
  label: string;
  value: string;
  sub: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{loading ? 'Loading...' : value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}
