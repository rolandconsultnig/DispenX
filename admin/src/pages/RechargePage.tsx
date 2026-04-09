import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Employee } from '../types';
import { Search, RefreshCw, BatteryCharging, Users } from 'lucide-react';
import toast from 'react-hot-toast';

interface RechargeLog {
  id: string;
  employeeId: string;
  rechargeType: string;
  quotaType: string;
  amountNaira: number;
  amountLiters: number;
  balanceBefore: number;
  balanceAfter: number;
  notes?: string;
  createdAt: string;
}

export default function RechargePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Single recharge modal
  const [showRecharge, setShowRecharge] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [rechargeForm, setRechargeForm] = useState({ quotaType: 'NAIRA', amountNaira: '', amountLiters: '', rechargeType: 'TOP_UP', fuelType: 'PMS', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  // Bulk recharge modal
  const [showBulk, setShowBulk] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkForm, setBulkForm] = useState({ quotaType: 'NAIRA', amountNaira: '', amountLiters: '', rechargeType: 'MONTHLY_ALLOCATION', fuelType: 'PMS', notes: '' });

  // Recharge history modal
  const [showHistory, setShowHistory] = useState(false);
  const [historyEmployee, setHistoryEmployee] = useState<Employee | null>(null);
  const [rechargeHistory, setRechargeHistory] = useState<RechargeLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchEmployees = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (search) params.set('search', search);
    api.get(`/employees?${params}`).then((res) => {
      setEmployees(res.data.data);
      setTotalPages(res.data.meta.totalPages);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchEmployees(); }, [page, search]);

  const openRecharge = (emp: Employee) => {
    setSelectedEmployee(emp);
    setRechargeForm({ quotaType: emp.quotaType, amountNaira: '', amountLiters: '', rechargeType: 'TOP_UP', fuelType: emp.fuelType || 'PMS', notes: '' });
    setShowRecharge(true);
  };

  const handleRecharge = async () => {
    if (!selectedEmployee) return;
    setSubmitting(true);
    try {
      await api.post(`/recharge/${selectedEmployee.id}`, {
        quotaType: rechargeForm.quotaType,
        amountNaira: rechargeForm.quotaType === 'NAIRA' ? Number(rechargeForm.amountNaira) : 0,
        amountLiters: rechargeForm.quotaType === 'LITERS' ? Number(rechargeForm.amountLiters) : 0,
        rechargeType: rechargeForm.rechargeType,
        fuelType: rechargeForm.fuelType,
        notes: rechargeForm.notes || undefined,
      });
      toast.success(`Recharged ${selectedEmployee.firstName} ${selectedEmployee.lastName}`);
      setShowRecharge(false);
      fetchEmployees();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Recharge failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkRecharge = async () => {
    if (selectedIds.size === 0) return toast.error('Select at least one employee');
    setSubmitting(true);
    try {
      const res = await api.post('/recharge/bulk', {
        employeeIds: Array.from(selectedIds),
        quotaType: bulkForm.quotaType,
        amountNaira: bulkForm.quotaType === 'NAIRA' ? Number(bulkForm.amountNaira) : 0,
        amountLiters: bulkForm.quotaType === 'LITERS' ? Number(bulkForm.amountLiters) : 0,
        rechargeType: bulkForm.rechargeType,
        fuelType: bulkForm.fuelType,
        notes: bulkForm.notes || undefined,
      });
      const d = res.data.data;
      toast.success(`Bulk recharge: ${d.successful} success, ${d.failed} failed`);
      setShowBulk(false);
      setSelectedIds(new Set());
      fetchEmployees();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Bulk recharge failed');
    } finally {
      setSubmitting(false);
    }
  };

  const openHistory = async (emp: Employee) => {
    setHistoryEmployee(emp);
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/recharge/history/${emp.id}`);
      setRechargeHistory(res.data.data);
    } catch {
      toast.error('Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === employees.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(employees.map((e) => e.id)));
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Recharge Cards</h1>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search employees..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
          </div>
          {selectedIds.size > 0 && (
            <button onClick={() => { setBulkForm({ quotaType: 'NAIRA', amountNaira: '', amountLiters: '', rechargeType: 'MONTHLY_ALLOCATION', fuelType: 'PMS', notes: '' }); setShowBulk(true); }} className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
              <Users className="h-4 w-4" /> Bulk Recharge ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3"><input type="checkbox" checked={selectedIds.size === employees.length && employees.length > 0} onChange={toggleAll} className="rounded" /></th>
                <th className="px-4 py-3">Staff ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Fuel Type</th>
                <th className="px-4 py-3">Quota Type</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-10 text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-400" /></td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-gray-400">No employees found</td></tr>
              ) : employees.map((emp) => (
                <tr key={emp.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.has(emp.id)} onChange={() => toggleSelect(emp.id)} className="rounded" /></td>
                  <td className="px-4 py-3 font-mono text-xs">{emp.staffId}</td>
                  <td className="px-4 py-3 font-medium">{emp.firstName} {emp.lastName}</td>
                  <td className="px-4 py-3 text-gray-500">{emp.organization?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${emp.fuelType === 'PMS' ? 'bg-orange-100 text-orange-700' : emp.fuelType === 'AGO' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'}`}>
                      {emp.fuelType || 'PMS'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{emp.quotaType}</td>
                  <td className="px-4 py-3 font-semibold">{emp.quotaType === 'NAIRA' ? `₦${emp.balanceNaira.toLocaleString()}` : `${emp.balanceLiters.toLocaleString()}L`}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${emp.cardStatus === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{emp.cardStatus}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openRecharge(emp)} className="flex items-center gap-1 rounded bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100" title="Recharge">
                        <BatteryCharging className="h-3.5 w-3.5" /> Recharge
                      </button>
                      <button onClick={() => openHistory(emp)} className="rounded bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100">History</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50">Previous</button>
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50">Next</button>
          </div>
        )}
      </div>

      {/* Single Recharge Modal */}
      {showRecharge && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">Recharge — {selectedEmployee.firstName} {selectedEmployee.lastName}</h2>
            <p className="mb-4 text-sm text-gray-500">Current balance: {selectedEmployee.quotaType === 'NAIRA' ? `₦${selectedEmployee.balanceNaira.toLocaleString()}` : `${selectedEmployee.balanceLiters.toLocaleString()}L`}</p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Fuel Type</label>
                <select value={rechargeForm.fuelType} onChange={(e) => setRechargeForm({ ...rechargeForm, fuelType: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm">
                  <option value="PMS">PMS (Petrol)</option>
                  <option value="AGO">AGO (Diesel)</option>
                  <option value="CNG">CNG (Gas)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Quota Type</label>
                <select value={rechargeForm.quotaType} onChange={(e) => setRechargeForm({ ...rechargeForm, quotaType: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm">
                  <option value="NAIRA">Naira (₦)</option>
                  <option value="LITERS">Liters (L)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Recharge Type</label>
                <select value={rechargeForm.rechargeType} onChange={(e) => setRechargeForm({ ...rechargeForm, rechargeType: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm">
                  <option value="TOP_UP">Top Up (add to existing)</option>
                  <option value="RESET">Reset (replace balance)</option>
                  <option value="MONTHLY_ALLOCATION">Monthly Allocation</option>
                </select>
              </div>
              {rechargeForm.quotaType === 'NAIRA' ? (
                <div>
                  <label className="mb-1 block text-sm font-medium">Amount (₦)</label>
                  <input type="number" min="0" value={rechargeForm.amountNaira} onChange={(e) => setRechargeForm({ ...rechargeForm, amountNaira: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="e.g. 50000" />
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-sm font-medium">Amount (Liters)</label>
                  <input type="number" min="0" step="0.1" value={rechargeForm.amountLiters} onChange={(e) => setRechargeForm({ ...rechargeForm, amountLiters: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="e.g. 100" />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">Notes (optional)</label>
                <input type="text" value={rechargeForm.notes} onChange={(e) => setRechargeForm({ ...rechargeForm, notes: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Reason for recharge" />
              </div>
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <button onClick={() => setShowRecharge(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button onClick={handleRecharge} disabled={submitting} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60">
                {submitting ? 'Processing...' : 'Recharge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Recharge Modal */}
      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">Bulk Recharge — {selectedIds.size} employees</h2>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Fuel Type</label>
                <select value={bulkForm.fuelType} onChange={(e) => setBulkForm({ ...bulkForm, fuelType: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm">
                  <option value="PMS">PMS (Petrol)</option>
                  <option value="AGO">AGO (Diesel)</option>
                  <option value="CNG">CNG (Gas)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Quota Type</label>
                <select value={bulkForm.quotaType} onChange={(e) => setBulkForm({ ...bulkForm, quotaType: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm">
                  <option value="NAIRA">Naira (₦)</option>
                  <option value="LITERS">Liters (L)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Recharge Type</label>
                <select value={bulkForm.rechargeType} onChange={(e) => setBulkForm({ ...bulkForm, rechargeType: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm">
                  <option value="MONTHLY_ALLOCATION">Monthly Allocation</option>
                  <option value="TOP_UP">Top Up</option>
                  <option value="RESET">Reset</option>
                </select>
              </div>
              {bulkForm.quotaType === 'NAIRA' ? (
                <div>
                  <label className="mb-1 block text-sm font-medium">Amount per employee (₦)</label>
                  <input type="number" min="0" value={bulkForm.amountNaira} onChange={(e) => setBulkForm({ ...bulkForm, amountNaira: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="e.g. 50000" />
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-sm font-medium">Amount per employee (Liters)</label>
                  <input type="number" min="0" step="0.1" value={bulkForm.amountLiters} onChange={(e) => setBulkForm({ ...bulkForm, amountLiters: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="e.g. 100" />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">Notes (optional)</label>
                <input type="text" value={bulkForm.notes} onChange={(e) => setBulkForm({ ...bulkForm, notes: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="e.g. May 2025 allocation" />
              </div>
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <button onClick={() => setShowBulk(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button onClick={handleBulkRecharge} disabled={submitting} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60">
                {submitting ? 'Processing...' : `Recharge ${selectedIds.size} employees`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recharge History Modal */}
      {showHistory && historyEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recharge History — {historyEmployee.firstName} {historyEmployee.lastName}</h2>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            {historyLoading ? (
              <div className="py-8 text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-400" /></div>
            ) : rechargeHistory.length === 0 ? (
              <p className="py-8 text-center text-gray-400">No recharge history</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-gray-500">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Before</th>
                    <th className="px-3 py-2">After</th>
                  </tr>
                </thead>
                <tbody>
                  {rechargeHistory.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="px-3 py-2 text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.rechargeType === 'TOP_UP' ? 'bg-blue-100 text-blue-700' : r.rechargeType === 'RESET' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>{r.rechargeType.replace('_', ' ')}</span>
                      </td>
                      <td className="px-3 py-2 font-medium">{r.quotaType === 'NAIRA' ? `₦${r.amountNaira.toLocaleString()}` : `${r.amountLiters}L`}</td>
                      <td className="px-3 py-2 text-gray-500">{r.quotaType === 'NAIRA' ? `₦${r.balanceBefore.toLocaleString()}` : `${r.balanceBefore}L`}</td>
                      <td className="px-3 py-2 font-semibold text-green-600">{r.quotaType === 'NAIRA' ? `₦${r.balanceAfter.toLocaleString()}` : `${r.balanceAfter}L`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
