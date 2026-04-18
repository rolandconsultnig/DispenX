import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import type { SiphoningAlert } from '../types';

type AlertStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'FALSE_POSITIVE';

const statusOptions: AlertStatus[] = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'FALSE_POSITIVE'];

export default function SiphoningAlertsPage() {
  const [status, setStatus] = useState<AlertStatus | 'ALL'>('OPEN');
  const [alerts, setAlerts] = useState<SiphoningAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ statusSummary?: Record<string, number> } | null>(null);

  async function loadAlerts() {
    setLoading(true);
    try {
      const query = status === 'ALL' ? '' : `?status=${status}`;
      const res = await api.get(`/telemetry/alerts/siphoning${query}`);
      setAlerts(res.data?.data || []);
      setMeta(res.data?.meta || null);
    } catch {
      setAlerts([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, nextStatus: AlertStatus) {
    setBusyId(id);
    try {
      await api.patch(`/telemetry/alerts/siphoning/${id}/status`, { status: nextStatus });
      await loadAlerts();
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    void loadAlerts();
  }, [status]);

  const openCount = useMemo(() => meta?.statusSummary?.OPEN || 0, [meta]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Smart Siphoning Alerts</h1>
            <p className="mt-1 text-sm text-slate-500">
              Compares liters dispensed with observed OBD2 fuel-level deltas and flags suspicious gaps.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Open alerts: {openCount}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AlertStatus | 'ALL')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">All statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadAlerts()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : alerts.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">No alerts for this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs font-medium text-slate-500">
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Staff</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Station</th>
                  <th className="px-4 py-3">Dispensed</th>
                  <th className="px-4 py-3">Expected vs Observed</th>
                  <th className="px-4 py-3">Suspected</th>
                  <th className="px-4 py-3">Confidence</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 align-top hover:bg-slate-50/70">
                    <td className="px-4 py-3 text-slate-600">{new Date(a.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">
                        {a.employee?.firstName} {a.employee?.lastName}
                      </p>
                      <p className="text-xs text-slate-500">{a.employee?.staffId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{a.vehicle?.plateNumber || 'N/A'}</p>
                      <p className="text-xs text-slate-500">{[a.vehicle?.make, a.vehicle?.model].filter(Boolean).join(' ') || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{a.transaction?.station?.name || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{Number(a.dispensedLiters).toFixed(2)}L</p>
                      <p className="text-xs text-slate-500">{a.transaction?.fuelType || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700">Expected: {Number(a.expectedFuelLevelDeltaPct).toFixed(1)}%</p>
                      <p className="text-slate-700">Observed: {Number(a.observedFuelLevelDeltaPct).toFixed(1)}%</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-rose-600">{Number(a.suspectedSiphonedLiters).toFixed(2)}L</td>
                    <td className="px-4 py-3">{Math.round(Number(a.confidenceScore) * 100)}%</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{a.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === a.id || a.status === 'UNDER_REVIEW'}
                          onClick={() => void updateStatus(a.id, 'UNDER_REVIEW')}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
                        >
                          Review
                        </button>
                        <button
                          type="button"
                          disabled={busyId === a.id || a.status === 'RESOLVED'}
                          onClick={() => void updateStatus(a.id, 'RESOLVED')}
                          className="rounded-md border border-emerald-300 px-2 py-1 text-xs text-emerald-700 disabled:opacity-50"
                        >
                          Resolve
                        </button>
                        <button
                          type="button"
                          disabled={busyId === a.id || a.status === 'FALSE_POSITIVE'}
                          onClick={() => void updateStatus(a.id, 'FALSE_POSITIVE')}
                          className="rounded-md border border-amber-300 px-2 py-1 text-xs text-amber-700 disabled:opacity-50"
                        >
                          False +
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
