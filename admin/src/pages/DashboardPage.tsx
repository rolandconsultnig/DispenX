import { useState, useEffect } from 'react';
import api from '../lib/api';
import { DashboardData } from '../types';
import { Users, CreditCard, Fuel, ArrowRightLeft, Receipt, TrendingUp, CarFront, MapPinned } from 'lucide-react';

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

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" /></div>;
  if (!data) return <div className="text-center text-gray-500">Failed to load dashboard</div>;

  const stats = [
    { label: 'Total Employees', value: data.totalEmployees, icon: Users, color: 'bg-blue-500' },
    { label: 'Active Cards', value: data.activeCards, icon: CreditCard, color: 'bg-green-500' },
    { label: 'Blocked Cards', value: data.blockedCards, icon: CreditCard, color: 'bg-red-500' },
    { label: 'Stations', value: data.totalStations, icon: Fuel, color: 'bg-purple-500' },
    { label: 'Monthly Txns', value: data.monthlyTransactions, icon: ArrowRightLeft, color: 'bg-orange-500' },
    { label: 'Pending Settlements', value: data.pendingSettlements, icon: Receipt, color: 'bg-yellow-500' },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm">
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${s.color} text-white`}>
              <s.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900">{s.value.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Volume */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-xl bg-gradient-to-r from-green-500 to-green-600 p-6 text-white shadow-sm">
          <TrendingUp className="h-10 w-10" />
          <div>
            <p className="text-sm opacity-80">Monthly Volume (₦)</p>
            <p className="text-3xl font-bold">₦{data.monthlyVolume.naira.toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white shadow-sm">
          <Fuel className="h-10 w-10" />
          <div>
            <p className="text-sm opacity-80">Monthly Volume (Liters)</p>
            <p className="text-3xl font-bold">{data.monthlyVolume.liters.toLocaleString()}L</p>
          </div>
        </div>
      </div>

      {/* Car Tracking */}
      <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Car Tracking</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            <MapPinned className="h-3 w-3" />
            {tracking?.summary?.totalTracked || 0} tracked
          </span>
        </div>

        {!tracking?.tracked?.length ? (
          <p className="py-6 text-sm text-gray-400">No tracking snapshots yet.</p>
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-green-100 bg-green-50 p-3">
                <p className="text-xs text-green-700">Online</p>
                <p className="text-xl font-semibold text-green-800">{tracking.summary.online.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                <p className="text-xs text-amber-700">Idle</p>
                <p className="text-xl font-semibold text-amber-800">{tracking.summary.idle.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-red-100 bg-red-50 p-3">
                <p className="text-xs text-red-700">Offline</p>
                <p className="text-xl font-semibold text-red-800">{tracking.summary.offline.toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-2">
              {tracking.tracked.slice(0, 6).map((item) => (
                <div key={item.employeeId} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-gray-100 p-2 text-gray-600">
                      <CarFront className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">
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
                    <p className="mt-1 text-xs text-gray-500">{item.minutesAgo} min ago</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent Transactions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-3 pr-4">Employee</th>
                <th className="pb-3 pr-4">Station</th>
                <th className="pb-3 pr-4">Liters</th>
                <th className="pb-3 pr-4">Amount (₦)</th>
                <th className="pb-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.recentTransactions.map((tx) => (
                <tr key={tx.id} className="border-b last:border-0">
                  <td className="py-3 pr-4">
                    <span className="font-medium">{tx.employee?.firstName} {tx.employee?.lastName}</span>
                    <span className="ml-1 text-xs text-gray-400">({tx.employee?.staffId})</span>
                  </td>
                  <td className="py-3 pr-4">{tx.station?.name}</td>
                  <td className="py-3 pr-4">{tx.amountLiters.toFixed(1)}L</td>
                  <td className="py-3 pr-4 font-medium">₦{tx.amountNaira.toLocaleString()}</td>
                  <td className="py-3 text-gray-500">{new Date(tx.transactedAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {data.recentTransactions.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400">No transactions yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
