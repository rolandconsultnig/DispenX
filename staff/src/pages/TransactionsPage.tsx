import { useState, useEffect } from 'react';
import api from '../lib/api';

export default function TransactionsPage() {
  const [txns, setTxns] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [page]);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get(`/transactions?page=${page}&limit=20`);
      setTxns(data.data);
      setMeta(data.meta);
    } catch {} finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-500 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold">Transaction History</h1>
        <p className="mt-1 text-sm text-indigo-100">Review all fuel purchases and channels in one place.</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Station</th>
              <th className="px-4 py-3">Fuel</th>
              <th className="px-4 py-3">Liters</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
            ) : txns.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No transactions found</td></tr>
            ) : txns.map(tx => (
              <tr key={tx.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{new Date(tx.transactedAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{tx.station?.name}</td>
                <td className="px-4 py-3"><span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{tx.fuelType}</span></td>
                <td className="px-4 py-3 text-slate-600">{tx.amountLiters.toFixed(1)}L</td>
                <td className="px-4 py-3 font-semibold text-slate-800">₦{tx.amountNaira.toLocaleString()}</td>
                <td className="px-4 py-3"><span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{tx.source}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Showing page {page} of {meta.totalPages} ({meta.total} total)</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50">Previous</button>
            <button onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
