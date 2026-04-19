import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, RefreshCw, Search } from 'lucide-react';
import api from '../lib/api';
import type { SiphoningAlert } from '../types';

type AlertStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'FALSE_POSITIVE';

const statusOptions: AlertStatus[] = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'FALSE_POSITIVE'];

export default function SiphoningAlertsPage() {
  const [status, setStatus] = useState<AlertStatus | 'ALL'>('OPEN');
  const [search, setSearch] = useState('');
  const [minConfidence, setMinConfidence] = useState<number | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<'createdAt:desc' | 'confidence:desc' | 'suspected:desc'>('createdAt:desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [alerts, setAlerts] = useState<SiphoningAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ statusSummary?: Record<string, number>; total?: number; totalPages?: number } | null>(null);

  const [reviewModal, setReviewModal] = useState<{
    open: boolean;
    id?: string;
    nextStatus?: AlertStatus;
    note: string;
  }>({ open: false, note: '' });

  async function loadAlerts() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (status !== 'ALL') p.set('status', status);
      if (search.trim()) p.set('search', search.trim());
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      if (minConfidence !== '' && Number.isFinite(Number(minConfidence))) p.set('minConfidence', String(minConfidence));
      if (sort) p.set('sort', sort);
      p.set('page', String(page));
      p.set('limit', String(limit));
      const query = `?${p.toString()}`;
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

  async function updateStatus(id: string, nextStatus: AlertStatus, note?: string) {
    setBusyId(id);
    try {
      await api.patch(`/telemetry/alerts/siphoning/${id}/status`, { status: nextStatus, reviewNote: note || undefined });
      await loadAlerts();
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    void loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, limit, sort]);

  const openCount = useMemo(() => meta?.statusSummary?.OPEN || 0, [meta]);
  const totalPages = useMemo(() => Math.max(1, meta?.totalPages || 1), [meta]);

  function exportCsv() {
    if (!alerts.length) return;
    const headers = [
      'Created',
      'Status',
      'Staff ID',
      'Employee',
      'Organization',
      'Vehicle',
      'Station',
      'DispensedLiters',
      'ExpectedDeltaPct',
      'ObservedDeltaPct',
      'SuspectedLiters',
      'ConfidencePct',
      'ReviewedAt',
      'ReviewedBy',
      'ReviewNote',
      'Reason',
    ];
    const rows = alerts.map((a) => [
      new Date(a.createdAt).toISOString(),
      a.status,
      a.employee?.staffId || '',
      `${a.employee?.firstName || ''} ${a.employee?.lastName || ''}`.trim(),
      a.employee?.organization?.name || '',
      a.vehicle?.plateNumber || '',
      a.transaction?.station?.name || '',
      String(a.dispensedLiters ?? ''),
      String(a.expectedFuelLevelDeltaPct ?? ''),
      String(a.observedFuelLevelDeltaPct ?? ''),
      String(a.suspectedSiphonedLiters ?? ''),
      String(Math.round(Number(a.confidenceScore || 0) * 100)),
      a.reviewedAt ? new Date(a.reviewedAt).toISOString() : '',
      a.reviewedBy ? `${a.reviewedBy.firstName || ''} ${a.reviewedBy.lastName || ''}`.trim() : '',
      a.reviewNote || '',
      a.reason || '',
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
    a.download = `siphoning-alerts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openReview(id: string, nextStatus: AlertStatus) {
    setReviewModal({ open: true, id, nextStatus, note: '' });
  }

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
            onChange={(e) => {
              setStatus(e.target.value as AlertStatus | 'ALL');
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">All statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff, plate, station, reason..."
              className="w-[280px] rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <select
            value={minConfidence === '' ? '' : String(minConfidence)}
            onChange={(e) => {
              const v = e.target.value;
              setMinConfidence(v === '' ? '' : Number(v));
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All confidence</option>
            <option value="0.6">60%+</option>
            <option value="0.75">75%+</option>
            <option value="0.85">85%+</option>
            <option value="0.9">90%+</option>
          </select>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as any);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="createdAt:desc">Newest first</option>
            <option value="confidence:desc">Highest confidence</option>
            <option value="suspected:desc">Most suspected liters</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              void loadAlerts();
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            disabled={!alerts.length}
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => void loadAlerts()}
            className="ml-auto rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Apply filters
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
                  <th className="px-4 py-3">Reviewed</th>
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
                      {a.reviewedAt ? (
                        <div className="text-xs text-slate-600">
                          <p>{new Date(a.reviewedAt).toLocaleString()}</p>
                          <p className="text-slate-500">
                            {a.reviewedBy ? `${a.reviewedBy.firstName} ${a.reviewedBy.lastName}` : '—'}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === a.id || a.status === 'UNDER_REVIEW'}
                          onClick={() => openReview(a.id, 'UNDER_REVIEW')}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
                        >
                          Review
                        </button>
                        <button
                          type="button"
                          disabled={busyId === a.id || a.status === 'RESOLVED'}
                          onClick={() => openReview(a.id, 'RESOLVED')}
                          className="rounded-md border border-emerald-300 px-2 py-1 text-xs text-emerald-700 disabled:opacity-50"
                        >
                          Resolve
                        </button>
                        <button
                          type="button"
                          disabled={busyId === a.id || a.status === 'FALSE_POSITIVE'}
                          onClick={() => openReview(a.id, 'FALSE_POSITIVE')}
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

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
          <span className="text-xs text-slate-500">
            Page <span className="font-semibold text-slate-700">{page}</span> of{' '}
            <span className="font-semibold text-slate-700">{totalPages}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Rows</span>
          <select
            value={String(limit)}
            onChange={(e) => {
              setLimit(parseInt(e.target.value, 10));
              setPage(1);
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

      {reviewModal.open && reviewModal.id && reviewModal.nextStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Update alert status</h3>
            <p className="mt-1 text-sm text-slate-600">
              Set status to <span className="font-semibold">{reviewModal.nextStatus.replace('_', ' ')}</span> and optionally add a review note.
            </p>

            <textarea
              value={reviewModal.note}
              onChange={(e) => setReviewModal((m) => ({ ...m, note: e.target.value }))}
              rows={5}
              placeholder="Review note (optional)..."
              className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewModal({ open: false, note: '' })}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = reviewModal.id!;
                  const st = reviewModal.nextStatus!;
                  const note = reviewModal.note.trim();
                  setReviewModal({ open: false, note: '' });
                  void updateStatus(id, st, note || undefined);
                }}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
