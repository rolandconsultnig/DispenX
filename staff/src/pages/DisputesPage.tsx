import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export default function DisputesPage() {
  const { employee } = useAuth();
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ transactionId: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [txns, setTxns] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [d, t] = await Promise.all([api.get('/disputes'), api.get('/transactions?limit=50')]);
      setDisputes(d.data?.data || d.data || []);
      setTxns(t.data.data || t.data);
    } catch {} finally { setLoading(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/disputes', { transactionId: form.transactionId, description: form.description });
      setShowForm(false);
      setForm({ transactionId: '', description: '' });
      load();
    } catch {} finally { setSubmitting(false); }
  }

  const statusColor: Record<string, string> = {
    OPEN: 'bg-blue-100 text-blue-700',
    UNDER_REVIEW: 'bg-yellow-100 text-yellow-700',
    RESOLVED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
  };

  if (!employee) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-500 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold">My Disputes</h1>
        <p className="mt-1 text-sm text-indigo-100">Raise and track transaction issues with transparent status updates.</p>
      </div>
      <div className="flex items-center justify-end">
        <button onClick={() => setShowForm(!showForm)}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          {showForm ? 'Cancel' : 'New Dispute'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Transaction</label>
            <select value={form.transactionId} onChange={e => setForm(f => ({ ...f, transactionId: e.target.value }))} required
              className="w-full rounded-xl border border-slate-300 p-2 text-sm">
              <option value="">Select transaction...</option>
              {txns.map((tx: any) => (
                <option key={tx.id} value={tx.id}>
                  {new Date(tx.transactedAt).toLocaleDateString()} - {tx.station?.name} - ₦{tx.amountNaira.toLocaleString()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required
              rows={3} className="w-full rounded-xl border border-slate-300 p-2 text-sm" placeholder="Describe the issue..." />
          </div>
          <button type="submit" disabled={submitting}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {submitting ? 'Submitting...' : 'Submit Dispute'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-400">Loading...</div>
      ) : disputes.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400 shadow-sm">No disputes yet</div>
      ) : (
        <div className="grid gap-4">
          {disputes.map((d: any) => (
            <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-slate-800">{d.description}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Transaction: {d.transaction?.station?.name} – ₦{d.transaction?.amountNaira?.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400">{new Date(d.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor[d.status] || 'bg-gray-100'}`}>
                  {d.status.replace('_', ' ')}
                </span>
              </div>
              {d.resolution && (
                <div className="mt-2 rounded-xl bg-slate-50 p-2 text-sm text-slate-600">
                  <strong>Resolution:</strong> {d.resolution}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
