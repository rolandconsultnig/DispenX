import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  CalendarRange,
  Download,
  FileSpreadsheet,
  Fuel,
  LineChart,
  Receipt,
  RefreshCw,
  Users,
} from 'lucide-react';
import api from '../lib/api';
import { reportCellText, staffIdFromEmployeeField } from '../lib/reportFormat';
import { useAuth } from '../context/AuthContext';
import { DashboardData, Organization } from '../types';

type ReportTab = 'executive' | 'transactions' | 'fuel' | 'stations' | 'settlements' | 'recharges';

const TAB_LABELS: Record<ReportTab, string> = {
  executive: 'Executive',
  transactions: 'Transactions',
  fuel: 'Fuel consumption',
  stations: 'Station performance',
  settlements: 'Settlements',
  recharges: 'Recharges',
};

function defaultRange() {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportingPage() {
  const { user } = useAuth();
  const isSuper = user?.role === 'SUPER_ADMIN';
  const [tab, setTab] = useState<ReportTab>('executive');
  const [{ from, to }, setRange] = useState(defaultRange);
  const [organizationId, setOrganizationId] = useState('');
  const [stationId, setStationId] = useState('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [stations, setStations] = useState<{ id: string; name: string }[]>([]);

  const [dash, setDash] = useState<DashboardData | null>(null);
  const [charts, setCharts] = useState<any>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [chartsLoading, setChartsLoading] = useState(false);

  const chartDays = useMemo(() => {
    const s = new Date(from).getTime();
    const e = new Date(to).getTime();
    const d = Math.ceil((e - s) / 86400000) + 1;
    return Math.min(Math.max(d, 7), 365);
  }, [from, to]);

  const reportParams = useMemo(() => {
    const p = new URLSearchParams({ from, to });
    if (isSuper && organizationId) p.set('organizationId', organizationId);
    if (tab === 'transactions' && stationId) p.set('stationId', stationId);
    return p;
  }, [from, to, isSuper, organizationId, stationId, tab]);

  const loadOrganizations = useCallback(async () => {
    if (!isSuper) return;
    try {
      const r = await api.get('/organizations');
      const d = r.data?.data;
      setOrganizations(Array.isArray(d) ? d : []);
    } catch {
      setOrganizations([]);
    }
  }, [isSuper]);

  const loadStations = useCallback(async () => {
    try {
      const r = await api.get('/stations');
      const list = r.data?.data || [];
      setStations(list.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
    } catch {
      setStations([]);
    }
  }, []);

  const loadExecutive = useCallback(async () => {
    setChartsLoading(true);
    try {
      const [dRes, cRes] = await Promise.all([
        api.get('/dashboard'),
        api.get(`/dashboard/charts?days=${chartDays}`),
      ]);
      setDash(dRes.data?.data ?? null);
      setCharts(cRes.data?.data ?? null);
    } catch {
      setDash(null);
      setCharts(null);
    } finally {
      setChartsLoading(false);
    }
  }, [chartDays]);

  const loadReport = useCallback(async () => {
    if (tab === 'executive') return;
    const typeMap: Record<Exclude<ReportTab, 'executive'>, string> = {
      transactions: 'transactions',
      fuel: 'fuel-consumption',
      stations: 'station-performance',
      settlements: 'settlements',
      recharges: 'recharges',
    };
    const type = typeMap[tab as Exclude<ReportTab, 'executive'>];
    setLoading(true);
    try {
      const r = await api.get(`/dashboard/reports?type=${type}&${reportParams.toString()}`);
      setReportData(r.data?.data ?? null);
    } catch {
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [tab, reportParams]);

  useEffect(() => {
    void loadOrganizations();
    void loadStations();
  }, [loadOrganizations, loadStations]);

  useEffect(() => {
    if (tab === 'executive') void loadExecutive();
  }, [tab, loadExecutive]);

  useEffect(() => {
    if (tab !== 'executive') void loadReport();
  }, [tab, loadReport]);

  const fuelPie = useMemo(() => {
    if (!charts?.fuelBreakdown?.length) return [];
    return charts.fuelBreakdown.map((f: { fuelType: string; naira: number }) => ({
      name: f.fuelType,
      value: f.naira,
    }));
  }, [charts]);

  const sourcePie = useMemo(() => {
    if (!charts?.sourceBreakdown?.length) return [];
    return charts.sourceBreakdown.map((s: { source: string; naira: number }) => ({
      name: String(s.source).replace(/_/g, ' '),
      value: s.naira,
    }));
  }, [charts]);

  const PIE_COLORS = ['#4f46e5', '#0891b2', '#16a34a', '#d97706', '#dc2626', '#7c3aed'];

  function exportCurrentReport() {
    if (!reportData?.rows?.length) return;
    const rows = reportData.rows as any[];
    let flat: Record<string, unknown>[] = [];
    if (tab === 'transactions') {
      flat = rows.map((t) => ({
        date: t.transactedAt,
        staffId: t.employee?.staffId,
        employee: `${t.employee?.firstName || ''} ${t.employee?.lastName || ''}`.trim(),
        organization: t.employee?.organization?.name,
        station: t.station?.name,
        fuelType: t.fuelType,
        liters: t.amountLiters,
        naira: t.amountNaira,
        source: t.source,
      }));
    } else if (tab === 'fuel') {
      flat = rows;
    } else if (tab === 'stations') {
      flat = rows;
    } else if (tab === 'settlements') {
      flat = rows.map((s) => ({
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        station: s.station?.name,
        organization: s.organization?.name,
        status: s.status,
        liters: s.totalLiters,
        naira: s.totalNairaDeducted,
        transactions: s.transactionCount,
      }));
    } else if (tab === 'recharges') {
      flat = rows;
    }
    downloadCsv(`energydispenx-report-${tab}-${from}_${to}.csv`, flat);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-indigo-100">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Reporting & analytics
            </div>
            <h1 className="text-2xl font-bold">Advanced reporting module</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-200">
              Executive KPIs, trend charts, and exportable operational reports scoped to your organization.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-300">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-300">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
              />
            </div>
            {isSuper && (
              <div>
                <label className="mb-1 block text-xs text-slate-300">Organization</label>
                <select
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                  className="min-w-[180px] rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
                >
                  <option value="">All organizations</option>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id} className="text-slate-900">
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (tab === 'executive') void loadExecutive();
                else void loadReport();
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
            >
              <RefreshCw className={`h-4 w-4 ${loading || chartsLoading ? 'animate-spin' : ''}`} />
              Apply
            </button>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {(Object.keys(TAB_LABELS) as ReportTab[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === k ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {TAB_LABELS[k]}
          </button>
        ))}
      </div>

      {tab === 'executive' && (
        <div className="space-y-6">
          {dash && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard icon={Users} label="Employees" value={dash.totalEmployees} tone="indigo" />
              <KpiCard icon={Fuel} label="Active cards" value={dash.activeCards} tone="emerald" />
              <KpiCard icon={BarChart3} label="Monthly txns" value={dash.monthlyTransactions} tone="amber" />
              <KpiCard icon={Receipt} label="Pending settlements" value={dash.pendingSettlements} tone="rose" />
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-slate-900">
                <LineChart className="h-5 w-5 text-indigo-500" />
                Volume trend ({chartDays}d window)
              </h2>
              <p className="mb-4 text-xs text-slate-500">Aligned to your selected date span (capped at 365 days).</p>
              <div className="h-72 min-h-[288px] min-w-0 w-full">
                {chartsLoading ? (
                  <div className="flex h-full items-center justify-center text-slate-400">
                    <RefreshCw className="h-8 w-8 animate-spin" />
                  </div>
                ) : charts?.dailyTrends?.length ? (
                  <ResponsiveContainer width="100%" height={288} minWidth={0}>
                    <AreaChart data={charts.dailyTrends}>
                      <defs>
                        <linearGradient id="repNaira" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="naira" name="Amount (₦)" stroke="#4f46e5" fill="url(#repNaira)" strokeWidth={2} />
                      <Area type="monotone" dataKey="liters" name="Liters" stroke="#0891b2" fillOpacity={0.2} fill="#0891b2" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Fuel mix (₦)</h2>
              <div className="h-64 min-h-[256px] min-w-0 w-full">
                {fuelPie.length ? (
                  <ResponsiveContainer width="100%" height={256} minWidth={0}>
                    <PieChart>
                      <Pie data={fuelPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                        {fuelPie.map((_: { name: string; value: number }, i: number) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `₦${Number(v).toLocaleString()}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Top stations (₦)</h2>
              <div className="h-72 min-h-[288px] min-w-0 w-full">
                {charts?.topStations?.length ? (
                  <ResponsiveContainer width="100%" height={288} minWidth={0}>
                    <BarChart data={charts.topStations} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => `₦${Number(v).toLocaleString()}`} />
                      <Bar dataKey="value" fill="#4f46e5" radius={[0, 6, 6, 0]} name="₦" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Channel / source (₦)</h2>
              <div className="h-72 min-h-[288px] min-w-0 w-full">
                {sourcePie.length ? (
                  <ResponsiveContainer width="100%" height={288} minWidth={0}>
                    <PieChart>
                      <Pie data={sourcePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                        {sourcePie.map((_: { name: string; value: number }, i: number) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `₦${Number(v).toLocaleString()}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Top drivers (30d)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-slate-500">
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Staff ID</th>
                    <th className="pb-2 pr-4">Txns</th>
                    <th className="pb-2 pr-4">Liters</th>
                    <th className="pb-2">Amount (₦)</th>
                  </tr>
                </thead>
                <tbody>
                  {(charts?.topEmployees || []).map((e: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-2 pr-4 font-medium text-slate-900">{e.name}</td>
                      <td className="py-2 pr-4 text-slate-500">{e.staffId}</td>
                      <td className="py-2 pr-4">{e.count}</td>
                      <td className="py-2 pr-4">{Number(e.liters || 0).toFixed(2)}</td>
                      <td className="py-2">₦{Number(e.naira || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                  {!charts?.topEmployees?.length && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No driver spend data in this window.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab !== 'executive' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <CalendarRange className="h-4 w-4 text-slate-400" />
              <span>
                {from} → {to}
              </span>
              {(reportData?.summary || tab === 'fuel' || tab === 'stations') && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {summaryLine(tab, reportData?.summary, reportData?.rows?.length ?? 0)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {tab === 'transactions' && (
                <select
                  value={stationId}
                  onChange={(e) => setStationId(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">All stations</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={exportCurrentReport}
                disabled={!reportData?.rows?.length}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {loading ? (
              <div className="flex justify-center py-20">
                <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
              </div>
            ) : (
              <ReportTable tab={tab} rows={reportData?.rows} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function summaryLine(tab: ReportTab, s: Record<string, unknown> | undefined, rowCount: number) {
  if (tab === 'fuel' || tab === 'stations') return `${rowCount} group${rowCount === 1 ? '' : 's'}`;
  if (!s) return '';
  if (tab === 'transactions')
    return `${s.count ?? 0} rows · ₦${Number(s.totalNaira || 0).toLocaleString()} · ${Number(s.totalLiters || 0).toFixed(2)} L`;
  if (tab === 'settlements')
    return `${s.count ?? 0} periods · ₦${Number(s.totalNaira || 0).toLocaleString()} · ${Number(s.totalLiters || 0).toFixed(2)} L`;
  if (tab === 'recharges')
    return `${s.count ?? 0} events · ₦${Number(s.totalNaira || 0).toLocaleString()} · ${Number(s.totalLiters || 0).toFixed(2)} L`;
  return '';
}

function ReportTable({ tab, rows }: { tab: ReportTab; rows: any[] | undefined }) {
  if (!rows?.length) {
    return <p className="p-10 text-center text-sm text-slate-500">No rows for this range and filters.</p>;
  }

  if (tab === 'transactions') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs font-medium text-slate-500">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Station</th>
              <th className="px-4 py-3">Fuel</th>
              <th className="px-4 py-3">Liters</th>
              <th className="px-4 py-3">₦</th>
              <th className="px-4 py-3">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, idx) => {
              const txnStaffId = staffIdFromEmployeeField(t.employee);
              return (
              <tr key={t.id ?? `txn-${idx}`} className="border-b border-slate-100 hover:bg-slate-50/80">
                <td className="px-4 py-3 text-slate-600">{new Date(t.transactedAt).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className="font-medium text-slate-900">{reportCellText(t.employee)}</span>
                  {txnStaffId ? <span className="ml-1 text-xs text-slate-400">({txnStaffId})</span> : null}
                </td>
                <td className="px-4 py-3">{t.station?.name}</td>
                <td className="px-4 py-3">{t.fuelType}</td>
                <td className="px-4 py-3">{Number(t.amountLiters).toFixed(3)}</td>
                <td className="px-4 py-3 font-medium">₦{Number(t.amountNaira).toLocaleString()}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{String(t.source)}</td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (tab === 'fuel') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs font-medium text-slate-500">
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Org</th>
              <th className="px-4 py-3">Fuel</th>
              <th className="px-4 py-3">Txns</th>
              <th className="px-4 py-3">Liters</th>
              <th className="px-4 py-3">₦</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${String(r.staffId ?? '')}-${String(r.fuelType ?? '')}-${i}`}
                className="border-b border-slate-100 hover:bg-slate-50/80"
              >
                <td className="px-4 py-3 font-medium">{reportCellText(r.employee)}</td>
                <td className="px-4 py-3 text-slate-600">{reportCellText(r.organization)}</td>
                <td className="px-4 py-3">{r.fuelType}</td>
                <td className="px-4 py-3">{r.count}</td>
                <td className="px-4 py-3">{Number(r.liters).toFixed(3)}</td>
                <td className="px-4 py-3">₦{Number(r.naira).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (tab === 'stations') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs font-medium text-slate-500">
              <th className="px-4 py-3">Station</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Txns</th>
              <th className="px-4 py-3">Liters</th>
              <th className="px-4 py-3">₦</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${reportCellText(r.station)}-${i}`} className="border-b border-slate-100 hover:bg-slate-50/80">
                <td className="px-4 py-3 font-medium">{reportCellText(r.station)}</td>
                <td className="px-4 py-3 text-slate-600">{r.location}</td>
                <td className="px-4 py-3">{r.count}</td>
                <td className="px-4 py-3">{Number(r.liters).toFixed(3)}</td>
                <td className="px-4 py-3">₦{Number(r.naira).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (tab === 'settlements') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs font-medium text-slate-500">
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Station</th>
              <th className="px-4 py-3">Org</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Txns</th>
              <th className="px-4 py-3">Liters</th>
              <th className="px-4 py-3">₦</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, idx) => (
              <tr key={s.id ?? `settlement-${idx}`} className="border-b border-slate-100 hover:bg-slate-50/80">
                <td className="px-4 py-3 text-slate-600">
                  {new Date(s.periodStart).toLocaleDateString()} – {new Date(s.periodEnd).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">{s.station?.name}</td>
                <td className="px-4 py-3">{s.organization?.name}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">{s.status}</span>
                </td>
                <td className="px-4 py-3">{s.transactionCount}</td>
                <td className="px-4 py-3">{Number(s.totalLiters).toFixed(3)}</td>
                <td className="px-4 py-3 font-medium">₦{Number(s.totalNairaDeducted).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (tab === 'recharges') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs font-medium text-slate-500">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Org</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Quota</th>
              <th className="px-4 py-3">₦</th>
              <th className="px-4 py-3">L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const rechargeStaffId =
                staffIdFromEmployeeField(r.employee) ||
                (typeof r.staffId === 'string' || typeof r.staffId === 'number' ? String(r.staffId) : '');
              return (
              <tr key={r.id ?? `recharge-${idx}`} className="border-b border-slate-100 hover:bg-slate-50/80">
                <td className="px-4 py-3 text-slate-600">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className="font-medium text-slate-900">{reportCellText(r.employeeName ?? r.employee)}</span>
                  {rechargeStaffId ? <span className="ml-1 text-xs text-slate-400">({rechargeStaffId})</span> : null}
                </td>
                <td className="px-4 py-3">{reportCellText(r.organization)}</td>
                <td className="px-4 py-3 text-xs">{r.rechargeType}</td>
                <td className="px-4 py-3 text-xs">{r.quotaType}</td>
                <td className="px-4 py-3">₦{Number(r.amountNaira).toLocaleString()}</td>
                <td className="px-4 py-3">{Number(r.amountLiters).toFixed(3)}</td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: 'indigo' | 'emerald' | 'amber' | 'rose';
}) {
  const ring =
    tone === 'indigo'
      ? 'bg-indigo-500'
      : tone === 'emerald'
        ? 'bg-emerald-500'
        : tone === 'amber'
          ? 'bg-amber-500'
          : 'bg-rose-500';
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-white ${ring}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
      <BarChart3 className="mb-2 h-8 w-8 opacity-40" />
      No chart data in this period.
    </div>
  );
}
