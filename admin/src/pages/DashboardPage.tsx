import { useState, useEffect } from 'react';
import api from '../lib/api';
import { reportCellText, staffIdFromEmployeeField } from '../lib/reportFormat';
import { DashboardData } from '../types';
import { Users, CreditCard, Fuel, ArrowRightLeft, Receipt, TrendingUp, CarFront, MapPinned } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

type FleetTrackingData = {
  summary: {
    totalTracked: number;
    online: number;
    idle: number;
    offline: number;
  };
  tracked: Array<{
    employeeId: string;
    name: string;
    staffId: string;
    minutesAgo: number;
    telemetryStatus: 'ONLINE' | 'IDLE' | 'OFFLINE';
    station?: {
      name?: string;
      location?: string;
    } | null;
  }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tracking, setTracking] = useState<FleetTrackingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/dashboard'), api.get('/fleet/tracking')])
      .then(([dashboardRes, trackingRes]) => {
        setData(dashboardRes.data.data);
        setTracking(trackingRes.data.data);
      })
      .catch(() => setLoading(false))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" /></div>;
  if (!data) return <div className="rounded-2xl border border-red-100 bg-white p-8 text-center text-red-500">Failed to load dashboard</div>;

  const stats = [
    { label: 'Total Employees', value: data.totalEmployees, icon: Users, color: 'bg-blue-500' },
    { label: 'Active Cards', value: data.activeCards, icon: CreditCard, color: 'bg-green-500' },
    { label: 'Blocked Cards', value: data.blockedCards, icon: CreditCard, color: 'bg-red-500' },
    { label: 'Stations', value: data.totalStations, icon: Fuel, color: 'bg-purple-500' },
    { label: 'Monthly Txns', value: data.monthlyTransactions, icon: ArrowRightLeft, color: 'bg-orange-500' },
    { label: 'Pending Settlements', value: data.pendingSettlements, icon: Receipt, color: 'bg-yellow-500' },
  ];
  const recentTransactions = Array.isArray(data.recentTransactions) ? data.recentTransactions : [];
  const trackedItems = Array.isArray(tracking?.tracked) ? tracking!.tracked : [];
  const statusData = [
    { name: 'Online', value: tracking?.summary?.online || 0, color: '#16a34a' },
    { name: 'Idle', value: tracking?.summary?.idle || 0, color: '#d97706' },
    { name: 'Offline', value: tracking?.summary?.offline || 0, color: '#dc2626' },
  ];
  const hasStatusData = statusData.some((s) => s.value > 0);

  const txByDayMap = recentTransactions.reduce<Record<string, { liters: number; naira: number }>>((acc, tx) => {
    const day = new Date(tx.transactedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!acc[day]) {
      acc[day] = { liters: 0, naira: 0 };
    }
    acc[day].liters += tx.amountLiters;
    acc[day].naira += tx.amountNaira;
    return acc;
  }, {});
  const txTrendData = Object.entries(txByDayMap).map(([day, totals]) => ({
    day,
    liters: Number(totals.liters.toFixed(2)),
    naira: Number((totals.naira / 1000).toFixed(2)),
  }));

  const hourlyOpsMap = recentTransactions.reduce<Record<number, number>>((acc, tx) => {
    const hour = new Date(tx.transactedAt).getHours();
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {});
  const hourlyOpsData = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${hour.toString().padStart(2, '0')}:00`,
    operations: hourlyOpsMap[hour] || 0,
  })).filter((point) => point.operations > 0);

  return (
    <div className="space-y-6">
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-500 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-indigo-100">Real-time operations, settlements, and fleet insights.</p>
      </div>

      {/* Monthly Volume */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 text-white shadow-sm xl:col-span-6">
          <TrendingUp className="h-10 w-10" />
          <div>
            <p className="text-sm opacity-80">Monthly Volume (₦)</p>
            <p className="text-3xl font-bold">₦{data.monthlyVolume.naira.toLocaleString()}</p>
          </div>
        </div>
        <div className="col-span-12 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 p-6 text-white shadow-sm xl:col-span-6">
          <Fuel className="h-10 w-10" />
          <div>
            <p className="text-sm opacity-80">Monthly Volume (Liters)</p>
            <p className="text-3xl font-bold">{data.monthlyVolume.liters.toLocaleString()}L</p>
          </div>
        </div>
      </div>

      {/* Infographic Charts */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Transaction Trend</h2>
            <p className="text-xs text-slate-500">Daily liters and amount trend from recent activity (amount in thousands)</p>
          </div>
          <div className="h-72 min-h-[288px] min-w-0 w-full">
            {txTrendData.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
                No transaction trend data yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={288} minWidth={0}>
                <AreaChart data={txTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorLiters" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="colorNaira" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0891b2" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#0891b2" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="liters" name="Liters" stroke="#4f46e5" fill="url(#colorLiters)" strokeWidth={2} />
                  <Area type="monotone" dataKey="naira" name="Amount (₦k)" stroke="#0891b2" fill="url(#colorNaira)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="col-span-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Fleet Telemetry Mix</h2>
            <p className="text-xs text-slate-500">Live online vs idle vs offline distribution</p>
          </div>
          <div className="h-72 min-h-[288px] min-w-0 w-full">
            {!hasStatusData ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
                No telemetry distribution yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={288} minWidth={0}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={64} outerRadius={96} paddingAngle={3}>
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Operations by Hour</h2>
          <p className="text-xs text-slate-500">Real-time operational intensity across the day</p>
        </div>
        <div className="h-72 min-h-[288px] min-w-0 w-full">
          {hourlyOpsData.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
              No hourly operations yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={288} minWidth={0}>
              <BarChart data={hourlyOpsData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={1} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="operations" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Car Tracking */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
          <h2 className="text-lg font-semibold text-slate-900">Car Tracking</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
            <MapPinned className="h-3 w-3" />
            {tracking?.summary?.totalTracked || 0} tracked
          </span>
        </div>

        {trackedItems.length === 0 ? (
          <p className="py-6 text-sm text-slate-400">No tracking snapshots yet.</p>
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-green-100 bg-green-50 p-3">
                <p className="text-xs text-green-700">Online</p>
                <p className="text-xl font-semibold text-green-800">{tracking?.summary?.online?.toLocaleString() || 0}</p>
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                <p className="text-xs text-amber-700">Idle</p>
                <p className="text-xl font-semibold text-amber-800">{tracking?.summary?.idle?.toLocaleString() || 0}</p>
              </div>
              <div className="rounded-lg border border-red-100 bg-red-50 p-3">
                <p className="text-xs text-red-700">Offline</p>
                <p className="text-xl font-semibold text-red-800">{tracking?.summary?.offline?.toLocaleString() || 0}</p>
              </div>
            </div>

            <div className="space-y-2">
              {trackedItems.slice(0, 6).map((item) => (
                <div key={item.employeeId} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-slate-100 p-2 text-slate-600">
                      <CarFront className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {item.staffId} {item.station?.name ? `• ${item.station.name}` : ''}{' '}
                        {item.station?.location ? `(${item.station.location})` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.telemetryStatus === 'ONLINE'
                          ? 'bg-green-100 text-green-700'
                          : item.telemetryStatus === 'IDLE'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {item.telemetryStatus}
                    </span>
                    <p className="mt-1 text-xs text-slate-500">{item.minutesAgo} min ago</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 border-b border-slate-100 pb-4">
          <h2 className="text-lg font-semibold text-slate-900">Recent Transactions</h2>
          <p className="text-xs text-slate-500">Latest deductions across all active channels</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="pb-3 pr-4">Employee</th>
                <th className="pb-3 pr-4">Station</th>
                <th className="pb-3 pr-4">Liters</th>
                <th className="pb-3 pr-4">Amount (₦)</th>
                <th className="pb-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((tx) => (
                <tr key={tx.id} className="border-b last:border-0">
                  <td className="py-3 pr-4">
                    <span className="font-medium">{reportCellText(tx.employee)}</span>
                    {(() => {
                      const sid = staffIdFromEmployeeField(tx.employee);
                      return sid ? <span className="ml-1 text-xs text-slate-400">({sid})</span> : null;
                    })()}
                  </td>
                  <td className="py-3 pr-4">{tx.station?.name}</td>
                  <td className="py-3 pr-4">{tx.amountLiters.toFixed(1)}L</td>
                  <td className="py-3 pr-4 font-medium">₦{tx.amountNaira.toLocaleString()}</td>
                  <td className="py-3 text-slate-500">{new Date(tx.transactedAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {recentTransactions.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-slate-400">No transactions yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-12 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="col-span-12 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-6 xl:col-span-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${s.color} text-white`}>
              <s.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500">{s.label}</p>
              <p className="text-2xl font-bold text-slate-900">{s.value.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
