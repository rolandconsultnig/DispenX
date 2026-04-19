import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { FraudCase, Organization } from '../types';

type FraudStatus = 'OPEN' | 'UNDER_REVIEW' | 'CONFIRMED' | 'DISMISSED';

const statusOptions: FraudStatus[] = ['OPEN', 'UNDER_REVIEW', 'CONFIRMED', 'DISMISSED'];

export default function FraudManagementPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [status, setStatus] = useState<FraudStatus | 'ALL'>('OPEN');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [cases, setCases] = useState<FraudCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ total?: number; totalPages?: number } | null>(null);

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    organizationId: '',
    category: '',
    title: '',
    description: '',
    employeeId: '',
    vehicleId: '',
    transactionId: '',
    severity: '3',
    riskScore: '',
  });

  const [statusModal, setStatusModal] = useState<{
    open: boolean;
    id?: string;
    nextStatus?: FraudStatus;
    resolutionNote: string;
  }>({ open: false, resolutionNote: '' });

  async function loadCases() {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams();
      if (status !== 'ALL') p.set('status', status);
      if (search.trim()) p.set('search', search.trim());
      p.set('page', String(page));
      p.set('limit', String(limit));
      const res = await api.get(`/fraud/cases?${p.toString()}`);
      setCases(res.data?.data || []);
      setMeta(res.data?.meta || null);
    } catch {
      setCases([]);
      setMeta(null);
      setError('Could not load fraud cases.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, limit]);

  useEffect(() => {
    if (!createOpen || !isSuperAdmin) return;
    void (async () => {
      try {
        const res = await api.get('/organizations');
        setOrgs(res.data?.data || []);
        if (res.data?.data?.length && !createForm.organizationId) {
          setCreateForm((f) => ({ ...f, organizationId: res.data.data[0].id }));
        }
      } catch {
        setOrgs([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createOpen, isSuperAdmin]);

  const totalPages = useMemo(() => Math.max(1, meta?.totalPages || 1), [meta]);

  async function submitCreate() {
    setError(null);
    const severity = parseInt(createForm.severity, 10);
    const riskScoreRaw = createForm.riskScore.trim();
    const payload: Record<string, unknown> = {
      category: createForm.category.trim(),
      title: createForm.title.trim(),
      description: createForm.description.trim(),
      severity: Number.isFinite(severity) ? severity : 3,
    };
    if (isSuperAdmin && createForm.organizationId) {
      payload.organizationId = createForm.organizationId;
    }
    if (createForm.employeeId.trim()) payload.employeeId = createForm.employeeId.trim();
    if (createForm.vehicleId.trim()) payload.vehicleId = createForm.vehicleId.trim();
    if (createForm.transactionId.trim()) payload.transactionId = createForm.transactionId.trim();
    if (riskScoreRaw) {
      const r = Number(riskScoreRaw);
      if (Number.isFinite(r)) payload.riskScore = r;
    }

    try {
      await api.post('/fraud/cases', payload);
      setCreateOpen(false);
      setCreateForm({
        organizationId: createForm.organizationId,
        category: '',
        title: '',
        description: '',
        employeeId: '',
        vehicleId: '',
        transactionId: '',
        severity: '3',
        riskScore: '',
      });
      setPage(1);
      await loadCases();
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e !== null && 'response' in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message || '')
          : '';
      setError(msg || 'Could not create case.');
    }
  }

  async function applyStatus(id: string, nextStatus: FraudStatus, resolutionNote?: string) {
    setBusyId(id);
    setError(null);
    try {
      await api.patch(`/fraud/cases/${id}/status`, {
        status: nextStatus,
        resolutionNote: resolutionNote || undefined,
      });
      await loadCases();
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e !== null && 'response' in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message || '')
          : '';
      setError(msg || 'Could not update status.');
    } finally {
      setBusyId(null);
    }
  }

  function openStatusModal(id: string, nextStatus: FraudStatus) {
    setStatusModal({ open: true, id, nextStatus, resolutionNote: '' });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Fraud management</h1>
            <p className="mt-1 text-sm text-slate-500">
              Track suspected fraud cases, link them to staff, vehicles, or transactions, and record review outcomes.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-800">
            <ShieldAlert className="h-3.5 w-3.5" />
            Cases: {meta?.total ?? cases.length}
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as FraudStatus | 'ALL');
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">All statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  void loadCases();
                }
              }}
              placeholder="Search category, title, staff, plate..."
              className="w-[280px] rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              void loadCases();
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Apply filters
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            New case
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : cases.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">No fraud cases for this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs font-medium text-slate-500">
                  <th className="px-4 py-3">Detected</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Staff / vehicle</th>
                  <th className="px-4 py-3">Transaction</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Review</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 align-top hover:bg-slate-50/70">
                    <td className="px-4 py-3 text-slate-600">{new Date(c.detectedAt).toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{c.category}</td>
                    <td className="max-w-[220px] px-4 py-3">
                      <p className="font-medium text-slate-900">{c.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{c.description}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {c.employee ? (
                        <div>
                          <p className="font-medium">
                            {c.employee.firstName} {c.employee.lastName}
                          </p>
                          <p className="text-xs text-slate-500">{c.employee.staffId}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                      {c.vehicle?.plateNumber ? (
                        <p className="mt-1 text-xs text-slate-600">{c.vehicle.plateNumber}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {c.transaction ? (
                        <div>
                          <p>{new Date(c.transaction.transactedAt).toLocaleString()}</p>
                          <p>
                            {Number(c.transaction.amountLiters).toFixed(2)}L / ₦
                            {Number(c.transaction.amountNaira).toFixed(0)}
                          </p>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">{c.severity}</td>
                    <td className="px-4 py-3">{c.riskScore != null ? `${c.riskScore}` : '—'}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                        {c.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {c.reviewedAt ? (
                        <div>
                          <p>{new Date(c.reviewedAt).toLocaleString()}</p>
                          <p className="text-slate-500">
                            {c.reviewedBy ? `${c.reviewedBy.firstName} ${c.reviewedBy.lastName}` : '—'}
                          </p>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === c.id || c.status === 'UNDER_REVIEW'}
                          onClick={() => openStatusModal(c.id, 'UNDER_REVIEW')}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
                        >
                          Review
                        </button>
                        <button
                          type="button"
                          disabled={busyId === c.id || c.status === 'CONFIRMED'}
                          onClick={() => openStatusModal(c.id, 'CONFIRMED')}
                          className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          disabled={busyId === c.id || c.status === 'DISMISSED'}
                          onClick={() => openStatusModal(c.id, 'DISMISSED')}
                          className="rounded-md border border-emerald-300 px-2 py-1 text-xs text-emerald-700 disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                        <button
                          type="button"
                          disabled={busyId === c.id || c.status === 'OPEN'}
                          onClick={() => openStatusModal(c.id, 'OPEN')}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 disabled:opacity-50"
                        >
                          Reopen
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

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">New fraud case</h3>
            <p className="mt-1 text-sm text-slate-600">Create a case for investigation. Optional links help auditors trace context.</p>

            {isSuperAdmin && (
              <label className="mt-4 block text-sm">
                <span className="font-medium text-slate-700">Organization</span>
                <select
                  value={createForm.organizationId}
                  onChange={(e) => setCreateForm((f) => ({ ...f, organizationId: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select organization</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="mt-3 block text-sm">
              <span className="font-medium text-slate-700">Category</span>
              <input
                value={createForm.category}
                onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. FUEL_THEFT, PAYMENT_ANOMALY"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium text-slate-700">Title</span>
              <input
                value={createForm.title}
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium text-slate-700">Description</span>
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                rows={4}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Severity (1–5)</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={createForm.severity}
                  onChange={(e) => setCreateForm((f) => ({ ...f, severity: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Risk score (0–100)</span>
                <input
                  value={createForm.riskScore}
                  onChange={(e) => setCreateForm((f) => ({ ...f, riskScore: e.target.value }))}
                  placeholder="Optional"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <label className="mt-3 block text-sm">
              <span className="font-medium text-slate-700">Employee ID (UUID)</span>
              <input
                value={createForm.employeeId}
                onChange={(e) => setCreateForm((f) => ({ ...f, employeeId: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium text-slate-700">Vehicle ID (UUID)</span>
              <input
                value={createForm.vehicleId}
                onChange={(e) => setCreateForm((f) => ({ ...f, vehicleId: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium text-slate-700">Transaction ID (UUID)</span>
              <input
                value={createForm.transactionId}
                onChange={(e) => setCreateForm((f) => ({ ...f, transactionId: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs"
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitCreate()}
                disabled={
                  !createForm.category.trim() ||
                  !createForm.title.trim() ||
                  createForm.description.trim().length < 10 ||
                  (isSuperAdmin && !createForm.organizationId)
                }
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {statusModal.open && statusModal.id && statusModal.nextStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Update case status</h3>
            <p className="mt-1 text-sm text-slate-600">
              Set status to <span className="font-semibold">{statusModal.nextStatus.replace(/_/g, ' ')}</span>. Add an optional resolution note.
            </p>
            <textarea
              value={statusModal.resolutionNote}
              onChange={(e) => setStatusModal((m) => ({ ...m, resolutionNote: e.target.value }))}
              rows={4}
              placeholder="Resolution note (optional)..."
              className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStatusModal({ open: false, resolutionNote: '' })}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = statusModal.id!;
                  const st = statusModal.nextStatus!;
                  const note = statusModal.resolutionNote.trim();
                  setStatusModal({ open: false, resolutionNote: '' });
                  void applyStatus(id, st, note || undefined);
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
