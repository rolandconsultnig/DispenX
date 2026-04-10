import { useState, useEffect } from 'react';
import api from '../lib/api';

export default function RechargesPage() {
  const [recharges, setRecharges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/recharges').then(r => setRecharges(r.data?.data || r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const statusColor: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    FAILED: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-500 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold">Recharge History</h1>
        <p className="mt-1 text-sm text-indigo-100">Track top-ups, allocations, and recharge approvals.</p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400">Loading...</div>
      ) : recharges.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400 shadow-sm">No recharges found</div>
      ) : (
        <div className="grid gap-4">
          {recharges.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <p className="font-semibold text-slate-800">₦{Number(r.amountNaira || r.amount || 0).toLocaleString()}</p>
                <p className="text-sm text-slate-500">{r.method === 'QR' ? 'QR Code' : (r.method || r.rechargeType || 'Recharge')} entry</p>
                <p className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor[r.status] || 'bg-gray-100 text-gray-600'}`}>
                  {r.status || 'COMPLETED'}
                </span>
                {r.approvedBy && <p className="mt-1 text-xs text-slate-400">by {r.approvedBy.firstName}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
