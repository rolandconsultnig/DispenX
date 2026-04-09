import { useState, useEffect } from 'react';
import api from '../lib/api';

export default function RechargesPage() {
  const [recharges, setRecharges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/recharges').then(r => setRecharges(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const statusColor: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    FAILED: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Recharge History</h1>

      {loading ? (
        <div className="py-12 text-center text-gray-400">Loading...</div>
      ) : recharges.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center text-gray-400 shadow">No recharges found</div>
      ) : (
        <div className="grid gap-4">
          {recharges.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg bg-white p-4 shadow">
              <div>
                <p className="font-semibold text-gray-800">₦{r.amount.toLocaleString()}</p>
                <p className="text-sm text-gray-500">{r.method === 'QR' ? 'QR Code' : r.method} recharge</p>
                <p className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor[r.status] || 'bg-gray-100 text-gray-600'}`}>
                  {r.status}
                </span>
                {r.approvedBy && <p className="mt-1 text-xs text-gray-400">by {r.approvedBy.firstName}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
