import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Employee } from '../types';
import { Plus, Search, Shield, ShieldOff, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

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

  const handleBlock = async (rfidUid: string, status: string) => {
    try {
      await api.post('/employees/card/block', { rfidUid, status });
      toast.success(`Card ${status.toLowerCase()}`);
      fetchEmployees();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleSave = async (formData: any) => {
    try {
      if (editingEmployee) {
        await api.put(`/employees/${editingEmployee.id}`, formData);
        toast.success('Employee updated');
      } else {
        await api.post('/employees', formData);
        toast.success('Employee created');
      }
      setShowModal(false);
      setEditingEmployee(null);
      fetchEmployees();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    }
  };

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    BLOCKED: 'bg-red-100 text-red-700',
    LOST: 'bg-gray-100 text-gray-700',
    EXPIRED: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, staff ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <button onClick={() => { setEditingEmployee(null); setShowModal(true); }} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
            <Plus className="h-4 w-4" /> Add Employee
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3">Staff ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">RFID</th>
                <th className="px-4 py-3">Fuel Type</th>
                <th className="px-4 py-3">Quota</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-10 text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-400" /></td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-gray-400">No employees found</td></tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{emp.staffId}</td>
                    <td className="px-4 py-3">{emp.firstName} {emp.lastName}</td>
                    <td className="px-4 py-3 font-mono text-xs">{emp.rfidUid || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${emp.fuelType === 'PMS' ? 'bg-orange-100 text-orange-700' : emp.fuelType === 'AGO' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'}`}>
                        {emp.fuelType || 'PMS'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {emp.quotaType === 'NAIRA' ? `₦${emp.quotaNaira.toLocaleString()}` : `${emp.quotaLiters}L`}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {emp.quotaType === 'NAIRA' ? `₦${emp.balanceNaira.toLocaleString()}` : `${emp.balanceLiters}L`}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[emp.cardStatus]}`}>
                        {emp.cardStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingEmployee(emp); setShowModal(true); }} className="rounded px-2 py-1 text-xs text-primary-600 hover:bg-primary-50">Edit</button>
                        {emp.rfidUid && emp.cardStatus === 'ACTIVE' && (
                          <button onClick={() => handleBlock(emp.rfidUid!, 'BLOCKED')} className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                            <ShieldOff className="h-3 w-3" /> Block
                          </button>
                        )}
                        {emp.rfidUid && emp.cardStatus === 'BLOCKED' && (
                          <button onClick={() => handleBlock(emp.rfidUid!, 'ACTIVE')} className="flex items-center gap-1 rounded px-2 py-1 text-xs text-green-600 hover:bg-green-50">
                            <Shield className="h-3 w-3" /> Activate
                          </button>
                        )}
                      </div>
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

      {/* Modal */}
      {showModal && (
        <EmployeeModal
          employee={editingEmployee}
          onClose={() => { setShowModal(false); setEditingEmployee(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function EmployeeModal({ employee, onClose, onSave }: { employee: Employee | null; onClose: () => void; onSave: (data: any) => void }) {
  const [form, setForm] = useState({
    staffId: employee?.staffId || '',
    firstName: employee?.firstName || '',
    lastName: employee?.lastName || '',
    phone: employee?.phone || '',
    email: employee?.email || '',
    rfidUid: employee?.rfidUid || '',
    fuelType: employee?.fuelType || 'PMS',
    quotaType: employee?.quotaType || 'NAIRA',
    quotaNaira: employee?.quotaNaira || 0,
    quotaLiters: employee?.quotaLiters || 0,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: name.includes('quota') && name !== 'quotaType' ? parseFloat(value) || 0 : value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold">{employee ? 'Edit Employee' : 'Add Employee'}</h2>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600">Staff ID</label>
              <input name="staffId" value={form.staffId} onChange={handleChange} required className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">RFID UID</label>
              <input name="rfidUid" value={form.rfidUid} onChange={handleChange} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">First Name</label>
              <input name="firstName" value={form.firstName} onChange={handleChange} required className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Last Name</label>
              <input name="lastName" value={form.lastName} onChange={handleChange} required className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Email</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600">Fuel Type</label>
              <select name="fuelType" value={form.fuelType} onChange={handleChange} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                <option value="PMS">PMS (Petrol)</option>
                <option value="AGO">AGO (Diesel)</option>
                <option value="CNG">CNG (Gas)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Quota Type</label>
              <select name="quotaType" value={form.quotaType} onChange={handleChange} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                <option value="NAIRA">Naira (₦)</option>
                <option value="LITERS">Liters (L)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600">Quota ₦</label>
              <input name="quotaNaira" type="number" value={form.quotaNaira} onChange={handleChange} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Quota Liters</label>
              <input name="quotaLiters" type="number" value={form.quotaLiters} onChange={handleChange} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
