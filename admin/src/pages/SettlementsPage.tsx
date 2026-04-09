import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Settlement } from '../types';
import { RefreshCw, FileText, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettlementsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSettlements = () => {
    setLoading(true);
    api.get(`/settlements?page=${page}&limit=25`).then((res) => {
      setSettlements(res.data.data);
      setTotalPages(res.data.meta.totalPages);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchSettlements(); }, [page]);

  const generateSettlements = async () => {
    try {
      const res = await api.post('/settlements/generate');
      toast.success(`Generated ${res.data.data.count} settlement(s)`);
      fetchSettlements();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/settlements/${id}/status`, { status });
      toast.success('Settlement updated');
      fetchSettlements();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const statusConfig: Record<string, { icon: typeof Clock; color: string; bg: string }> = {
    PENDING: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
    PARTIALLY_PAID: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-100' },
    SETTLED: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
    DISPUTED: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Settlements</h1>
        <button onClick={generateSettlements} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
          <FileText className="h-4 w-4" /> Generate Monthly
        </button>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Station</th>
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Total Liters</th>
                <th className="px-4 py-3">Total (₦)</th>
                <th className="px-4 py-3">Txn Count</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-10 text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-400" /></td></tr>
              ) : settlements.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-gray-400">No settlements found. Click "Generate Monthly" to create.</td></tr>
              ) : (
                settlements.map((s) => {
                  const cfg = statusConfig[s.status] || statusConfig.PENDING;
                  const StatusIcon = cfg.icon;
                  return (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-500">
                          {new Date(s.periodStart).toLocaleDateString()} – {new Date(s.periodEnd).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">{s.station?.name}</td>
                      <td className="px-4 py-3">{s.organization?.name}</td>
                      <td className="px-4 py-3">{s.totalLiters.toFixed(1)}L</td>
                      <td className="px-4 py-3 font-semibold">₦{s.totalNairaDeducted.toLocaleString()}</td>
                      <td className="px-4 py-3">{s.transactionCount}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                          <StatusIcon className="h-3 w-3" /> {s.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {s.status === 'PENDING' && (
                            <>
                              <button onClick={() => updateStatus(s.id, 'SETTLED')} className="rounded px-2 py-1 text-xs text-green-600 hover:bg-green-50">Mark Paid</button>
                              <button onClick={() => updateStatus(s.id, 'DISPUTED')} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50">Dispute</button>
                            </>
                          )}
                          {s.status === 'DISPUTED' && (
                            <button onClick={() => updateStatus(s.id, 'SETTLED')} className="rounded px-2 py-1 text-xs text-green-600 hover:bg-green-50">Resolve & Pay</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-50">Previous</button>
            <span className="text-gray-500">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-50">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
