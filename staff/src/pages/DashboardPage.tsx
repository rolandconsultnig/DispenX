import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Fuel, CreditCard, TrendingDown, ArrowRightLeft } from 'lucide-react';

export default function DashboardPage() {
  const { employee, refresh } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refresh();
    api.get('/transactions?limit=5').then(r => setTransactions(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (!employee) return null;

  const balance = employee.quotaType === 'NAIRA'
    ? `₦${employee.balanceNaira.toLocaleString()}`
    : `${employee.balanceLiters.toFixed(1)}L`;
  const quota = employee.quotaType === 'NAIRA'
    ? `₦${employee.quotaNaira.toLocaleString()}`
    : `${employee.quotaLiters.toFixed(1)}L`;
  const pct = employee.quotaType === 'NAIRA'
    ? (employee.quotaNaira > 0 ? (employee.balanceNaira / employee.quotaNaira) * 100 : 0)
    : (employee.quotaLiters > 0 ? (employee.balanceLiters / employee.quotaLiters) * 100 : 0);
  const barColor = pct > 50 ? 'bg-green-500' : pct > 20 ? 'bg-yellow-500' : 'bg-red-500';

  const fuelLabel: Record<string, string> = { PMS: 'Petrol (PMS)', AGO: 'Diesel (AGO)', CNG: 'CNG' };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Welcome, {employee.firstName}!</h1>

      {/* Balance Card */}
      <div className="rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-primary-200">Current Balance</p>
            <p className="mt-1 text-3xl font-bold">{balance}</p>
            <p className="mt-1 text-sm text-primary-200">of {quota} quota</p>
          </div>
          <Fuel className="h-12 w-12 text-primary-300" />
        </div>
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-primary-900/40">
            <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <p className="mt-1 text-xs text-primary-200">{pct.toFixed(0)}% remaining</p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2"><Fuel className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Fuel Type</p>
              <p className="font-semibold text-gray-800">{fuelLabel[employee.fuelType] || employee.fuelType}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2"><CreditCard className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Card Status</p>
              <p className="font-semibold text-gray-800">{employee.cardStatus}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2"><TrendingDown className="h-5 w-5 text-purple-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Quota Type</p>
              <p className="font-semibold text-gray-800">{employee.quotaType}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-lg bg-white shadow">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <ArrowRightLeft className="h-5 w-5 text-gray-500" />
          <h2 className="font-semibold text-gray-800">Recent Transactions</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No transactions yet</div>
        ) : (
          <div className="divide-y">
            {transactions.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{tx.station?.name}</p>
                  <p className="text-xs text-gray-500">{new Date(tx.transactedAt).toLocaleString()} · {tx.source}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-red-600">-₦{tx.amountNaira.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{tx.amountLiters.toFixed(1)}L</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
