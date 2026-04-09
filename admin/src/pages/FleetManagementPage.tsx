import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Users, Fuel, Receipt, RefreshCw, MapPinned, Router } from 'lucide-react';
import api from '../lib/api';
import { DashboardData, Employee, Organization, Station } from '../types';

export default function FleetManagementPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [tracking, setTracking] = useState<any>(null);
  const [iotHealth, setIotHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard'),
      api.get('/organizations'),
      api.get('/employees?page=1&limit=300'),
      api.get('/stations'),
      api.get('/fleet/tracking'),
      api.get('/fleet/iot-health'),
    ])
      .then(([dashRes, orgRes, empRes, stationRes, trackingRes, iotRes]) => {
        setDashboard(dashRes.data.data);
        setOrganizations(orgRes.data.data);
        setEmployees(empRes.data.data);
        setStations(stationRes.data.data);
        setTracking(trackingRes.data.data);
        setIotHealth(iotRes.data.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const totals = useMemo(() => {
    const activeStations = stations.filter((s) => s.isActive).length;
    const litersEmployees = employees.filter((e) => e.quotaType === 'LITERS').length;
    const nairaEmployees = employees.filter((e) => e.quotaType === 'NAIRA').length;
    return { activeStations, litersEmployees, nairaEmployees };
  }, [stations, employees]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fleet Management</h1>
          <p className="text-sm text-gray-500">Organization-level oversight for staff, fuel allocations and stations.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/organizations" className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50">
            Manage Organizations
          </Link>
          <Link to="/recharge" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
            Allocate Fuel
          </Link>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Organizations" value={organizations.length.toLocaleString()} icon={Building2} color="bg-indigo-500" />
        <StatCard label="Employees" value={employees.length.toLocaleString()} icon={Users} color="bg-blue-500" />
        <StatCard label="Stations" value={`${totals.activeStations}/${stations.length}`} icon={Fuel} color="bg-green-500" />
        <StatCard label="Pending Settlements" value={(dashboard?.pendingSettlements || 0).toLocaleString()} icon={Receipt} color="bg-orange-500" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Organization Fleet Size</h2>
          {loading ? (
            <div className="py-10 text-center">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : organizations.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">No organizations available.</p>
          ) : (
            <div className="space-y-3">
              {organizations.map((org) => (
                <div key={org.id} className="rounded-lg border p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="font-medium text-gray-900">{org.name}</p>
                    <span className="text-sm font-semibold text-gray-700">{org._count?.employees || 0} staff</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Credit limit: ₦{org.creditLimit.toLocaleString()}</span>
                    <span>Cycle: {org.settlementCycleDays} days</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Fuel Allocation Mix</h2>
          {loading ? (
            <div className="py-10 text-center">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-4">
              <MixBar
                label="Quota Type"
                leftLabel="Naira"
                leftValue={totals.nairaEmployees}
                rightLabel="Liters"
                rightValue={totals.litersEmployees}
              />
              <MixBar
                label="Card Status"
                leftLabel="Active"
                leftValue={dashboard?.activeCards || 0}
                rightLabel="Blocked"
                rightValue={dashboard?.blockedCards || 0}
              />
              <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-600">
                Monthly transactions: <span className="font-semibold">{(dashboard?.monthlyTransactions || 0).toLocaleString()}</span>
                <br />
                Monthly volume: <span className="font-semibold">₦{(dashboard?.monthlyVolume.naira || 0).toLocaleString()}</span> and{' '}
                <span className="font-semibold">{(dashboard?.monthlyVolume.liters || 0).toLocaleString()}L</span>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Fleet Tracking</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              <MapPinned className="h-3 w-3" />
              {tracking?.summary?.totalTracked || 0} tracked
            </span>
          </div>
          {loading ? (
            <div className="py-10 text-center">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : !tracking?.tracked?.length ? (
            <p className="py-8 text-sm text-gray-400">No tracking snapshots yet.</p>
          ) : (
            <div className="space-y-2">
              {tracking.tracked.slice(0, 8).map((item: any) => (
                <div key={item.employeeId} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.telemetryStatus === 'ONLINE'
                          ? 'bg-green-100 text-green-700'
                          : item.telemetryStatus === 'IDLE'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {item.telemetryStatus}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {item.station?.name || 'Unknown station'} {item.station?.location ? `• ${item.station.location}` : ''}
                    </span>
                    <span>{item.minutesAgo} min ago</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">IoT Device Health</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
              <Router className="h-3 w-3" />
              {iotHealth?.summary?.devices || 0} devices
            </span>
          </div>
          {loading ? (
            <div className="py-10 text-center">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-lg border bg-gray-50 p-3 text-xs text-gray-600">
                Healthy: <span className="font-semibold text-green-700">{iotHealth?.summary?.healthy || 0}</span> • Degraded:{' '}
                <span className="font-semibold text-amber-700">{iotHealth?.summary?.degraded || 0}</span> • Offline:{' '}
                <span className="font-semibold text-red-700">{iotHealth?.summary?.offline || 0}</span> • Alerts:{' '}
                <span className="font-semibold">{iotHealth?.summary?.alerts || 0}</span>
              </div>
              {(iotHealth?.alerts || []).slice(0, 6).map((alert: any, idx: number) => (
                <div
                  key={`${alert.stationId}-${idx}`}
                  className={`rounded-lg border p-3 text-xs ${
                    alert.level === 'CRITICAL'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : alert.level === 'WARN'
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-blue-200 bg-blue-50 text-blue-700'
                  }`}
                >
                  <span className="font-semibold">{alert.stationName}:</span> {alert.message}
                </div>
              ))}
              {!iotHealth?.alerts?.length && <p className="py-2 text-xs text-gray-400">No active IoT alerts.</p>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MixBar({
  label,
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
}: {
  label: string;
  leftLabel: string;
  leftValue: number;
  rightLabel: string;
  rightValue: number;
}) {
  const total = leftValue + rightValue;
  const leftPct = total === 0 ? 0 : (leftValue / total) * 100;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500">{total.toLocaleString()} total</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full bg-primary-600" style={{ width: `${leftPct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>{leftLabel}: {leftValue.toLocaleString()}</span>
        <span>{rightLabel}: {rightValue.toLocaleString()}</span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm">
      <div className={`flex h-12 w-12 items-center justify-center rounded-lg text-white ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
