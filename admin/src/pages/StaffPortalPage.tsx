import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users, CreditCard, CircleDollarSign, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import { Employee } from '../types';

export default function StaffPortalPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api
      .get('/employees?page=1&limit=200')
      .then((res) => setEmployees(res.data.data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((emp) =>
      `${emp.firstName} ${emp.lastName} ${emp.staffId} ${emp.rfidUid || ''}`.toLowerCase().includes(q)
    );
  }, [employees, query]);

  const activeCards = employees.filter((emp) => emp.cardStatus === 'ACTIVE').length;
  const blockedCards = employees.filter((emp) => emp.cardStatus === 'BLOCKED').length;
  const totalNairaBalance = employees.reduce((acc, emp) => acc + (emp.balanceNaira || 0), 0);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Portal</h1>
          <p className="text-sm text-gray-500">Staff directory, card status and recharge entry points.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/employees" className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50">
            Manage Staff
          </Link>
          <Link to="/recharge" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
            Recharge Wallets
          </Link>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Staff" value={employees.length.toLocaleString()} icon={Users} color="bg-blue-500" />
        <StatCard label="Active Cards" value={activeCards.toLocaleString()} icon={CreditCard} color="bg-green-500" />
        <StatCard label="Blocked Cards" value={blockedCards.toLocaleString()} icon={CreditCard} color="bg-red-500" />
        <StatCard label="Wallet Balance (₦)" value={totalNairaBalance.toLocaleString()} icon={CircleDollarSign} color="bg-purple-500" />
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        <div className="border-b p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find staff by name, ID or RFID..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3">Staff ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Fuel</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Card</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-400">
                    No staff matched your search.
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => (
                  <tr key={emp.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{emp.staffId}</td>
                    <td className="px-4 py-3">{emp.firstName} {emp.lastName}</td>
                    <td className="px-4 py-3">{emp.organization?.name || '—'}</td>
                    <td className="px-4 py-3">{emp.fuelType}</td>
                    <td className="px-4 py-3 font-semibold">
                      {emp.quotaType === 'NAIRA' ? `₦${emp.balanceNaira.toLocaleString()}` : `${emp.balanceLiters.toLocaleString()}L`}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        emp.cardStatus === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {emp.cardStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link to="/employees" className="rounded border px-2 py-1 text-xs hover:bg-gray-50">
                          Edit
                        </Link>
                        <Link to="/recharge" className="rounded bg-primary-50 px-2 py-1 text-xs text-primary-700 hover:bg-primary-100">
                          Recharge
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm">
      <div className={`flex h-12 w-12 items-center justify-center rounded-lg text-white ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
