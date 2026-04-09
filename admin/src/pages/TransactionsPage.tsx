import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Transaction } from '../types';
import { RefreshCw, Download } from 'lucide-react';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchTransactions = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    api.get(`/transactions?${params}`).then((res) => {
      setTransactions(res.data.data);
      setTotalPages(res.data.meta.totalPages);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchTransactions(); }, [page, from, to]);

  const exportCsv = () => {
    const headers = ['Date', 'Employee', 'Staff ID', 'Station', 'Fuel Type', 'Liters', 'Amount (₦)', 'Pump Price', 'Type'];
    const rows = transactions.map((tx) => [
      new Date(tx.transactedAt).toLocaleString(),
      `${tx.employee?.firstName} ${tx.employee?.lastName}`,
      tx.employee?.staffId,
      tx.station?.name,
      tx.fuelType || 'PMS',
      tx.amountLiters.toFixed(2),
      tx.amountNaira.toFixed(2),
      tx.pumpPriceAtTime,
      tx.quotaType,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <div className="flex flex-wrap gap-2">
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="rounded-lg border px-3 py-2 text-sm" />
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="rounded-lg border px-3 py-2 text-sm" />
          <button onClick={exportCsv} className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Station</th>
                <th className="px-4 py-3">Fuel</th>
                <th className="px-4 py-3">Liters</th>
                <th className="px-4 py-3">Amount (₦)</th>
                <th className="px-4 py-3">Price/L</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Sync</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-10 text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-400" /></td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-gray-400">No transactions found</td></tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{new Date(tx.transactedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{tx.employee?.firstName} {tx.employee?.lastName}</div>
                      <div className="text-xs text-gray-400">{tx.employee?.staffId}</div>
                    </td>
                    <td className="px-4 py-3">{tx.station?.name}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tx.fuelType === 'PMS' ? 'bg-orange-100 text-orange-700' : tx.fuelType === 'AGO' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'}`}>
                        {tx.fuelType || 'PMS'}
                      </span>
                    </td>
                    <td className="px-4 py-3">{tx.amountLiters.toFixed(1)}L</td>
                    <td className="px-4 py-3 font-semibold">₦{tx.amountNaira.toLocaleString()}</td>
                    <td className="px-4 py-3">₦{tx.pumpPriceAtTime}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tx.quotaType === 'NAIRA' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {tx.quotaType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tx.syncStatus === 'SYNCED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {tx.syncStatus}
                      </span>
                    </td>
                  </tr>
                ))
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
