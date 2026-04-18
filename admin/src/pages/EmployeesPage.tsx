import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { Employee, Organization } from '../types';
import { Plus, Search, Shield, ShieldOff, RefreshCw, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const ORG_STORAGE_KEY = 'admin_employees_org_id';

const CSV_TEMPLATE = `staffId,firstName,lastName,phone,email,rfidUid,quotaType,quotaNaira,quotaLiters,fuelType,allotmentCategory,pin
DRV001,Ada,Okafor,,ada@example.com,,NAIRA,50000,0,PMS,Fleet band A,
DRV002,Chidi,Eze,,,,LITERS,0,200,AGO,Field ops,
`;

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (c === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function normalizeCsvHeader(raw: string): string {
  const h = raw.replace(/^\ufeff/, '').trim().toLowerCase().replace(/\s+/g, '');
  const aliases: Record<string, string> = {
    staffid: 'staffId',
    employeeid: 'staffId',
    firstname: 'firstName',
    lastname: 'lastName',
    quotatype: 'quotaType',
    quotanaira: 'quotaNaira',
    quotaliters: 'quotaLiters',
    fueltype: 'fuelType',
    allotmentcategory: 'allotmentCategory',
    fuellallotmentcategory: 'allotmentCategory',
    fuelallotmentcategory: 'allotmentCategory',
    rfid: 'rfidUid',
    rfiduid: 'rfidUid',
  };
  return aliases[h] || raw.replace(/^\ufeff/, '').trim();
}

function parseEmployeesCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd());
  const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);
  if (nonEmpty.length < 2) throw new Error('CSV needs a header row and at least one data row.');
  const headers = splitCsvLine(nonEmpty[0]).map((h) => normalizeCsvHeader(h));
  const rows: Record<string, string>[] = [];
  for (let li = 1; li < nonEmpty.length; li++) {
    const cells = splitCsvLine(nonEmpty[li]);
    if (cells.length === 1 && cells[0] === '') continue;
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function rowToEmployeePayload(row: Record<string, string>): Record<string, unknown> | null {
  const staffId = row.staffId?.trim();
  const firstName = row.firstName?.trim();
  const lastName = row.lastName?.trim();
  if (!staffId || !firstName || !lastName) return null;
  const qt = row.quotaType?.trim().toUpperCase();
  const quotaType = qt === 'LITERS' || qt === 'NAIRA' ? qt : undefined;
  const ft = row.fuelType?.trim().toUpperCase();
  const fuelType = ft === 'PMS' || ft === 'AGO' || ft === 'CNG' ? ft : undefined;
  const pin = row.pin?.trim();
  return {
    staffId,
    firstName,
    lastName,
    phone: row.phone?.trim() || undefined,
    email: row.email?.trim() || undefined,
    rfidUid: row.rfidUid?.trim() || undefined,
    pin: pin || undefined,
    quotaType,
    quotaNaira: row.quotaNaira ? parseFloat(row.quotaNaira) : undefined,
    quotaLiters: row.quotaLiters ? parseFloat(row.quotaLiters) : undefined,
    fuelType,
    allotmentCategory: row.allotmentCategory?.trim() || undefined,
  };
}

export default function EmployeesPage() {
  const { user } = useAuth();
  const isSuper = user?.role === 'SUPER_ADMIN';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgFilterId, setOrgFilterId] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkRunning, setBulkRunning] = useState(false);

  useEffect(() => {
    if (!isSuper) return;
    const saved = localStorage.getItem(ORG_STORAGE_KEY);
    if (saved) setOrgFilterId(saved);
    api.get('/organizations').then((res) => setOrganizations(res.data.data)).catch(() => {});
  }, [isSuper]);

  const fetchEmployees = useCallback(() => {
    if (isSuper && !orgFilterId) {
      setEmployees([]);
      setTotalPages(1);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (search) params.set('search', search);
    if (isSuper && orgFilterId) params.set('organizationId', orgFilterId);
    api
      .get(`/employees?${params}`)
      .then((res) => {
        setEmployees(res.data.data);
        setTotalPages(res.data.meta.totalPages);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, search, isSuper, orgFilterId]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const setOrgFilter = (id: string) => {
    setOrgFilterId(id);
    setPage(1);
    if (isSuper) {
      if (id) localStorage.setItem(ORG_STORAGE_KEY, id);
      else localStorage.removeItem(ORG_STORAGE_KEY);
    }
  };

  const handleBlock = async (rfidUid: string, status: string) => {
    try {
      await api.post('/employees/card/block', { rfidUid, status });
      toast.success(`Card ${status.toLowerCase()}`);
      fetchEmployees();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleSave = async (formData: Record<string, unknown>) => {
    if (isSuper && !orgFilterId && !editingEmployee) {
      toast.error('Select an organization before adding employees');
      return;
    }
    try {
      const payload = { ...formData };
      if (isSuper && !editingEmployee) (payload as any).organizationId = orgFilterId;
      if (editingEmployee) {
        await api.put(`/employees/${editingEmployee.id}`, payload);
        toast.success('Employee updated');
      } else {
        await api.post('/employees', payload);
        toast.success('Employee created');
      }
      setShowModal(false);
      setEditingEmployee(null);
      fetchEmployees();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    }
  };

  const runBulkImport = async () => {
    if (isSuper && !orgFilterId) {
      toast.error('Select an organization first');
      return;
    }
    let rows: Record<string, string>[];
    try {
      rows = parseEmployeesCsv(bulkText);
    } catch (e: any) {
      toast.error(e.message || 'Invalid CSV');
      return;
    }
    const employeesPayload = rows.map(rowToEmployeePayload).filter(Boolean) as Record<string, unknown>[];
    if (employeesPayload.length === 0) {
      toast.error('No valid rows (each needs staffId, firstName, lastName)');
      return;
    }
    setBulkRunning(true);
    try {
      const body: { employees: typeof employeesPayload; organizationId?: string } = { employees: employeesPayload };
      if (isSuper) body.organizationId = orgFilterId;
      const res = await api.post('/employees/bulk', body);
      const { createdCount, failedCount, errors } = res.data.data;
      toast.success(`Imported ${createdCount} employee(s)${failedCount ? `, ${failedCount} failed` : ''}`);
      if (errors?.length) {
        console.warn('Bulk import errors', errors);
        toast.error(errors.slice(0, 3).map((e: any) => `${e.staffId || e.index}: ${e.message}`).join('; '));
      }
      setShowBulkModal(false);
      setBulkText('');
      fetchEmployees();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Bulk import failed');
    } finally {
      setBulkRunning(false);
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          {isSuper && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Organization</label>
              <select
                value={orgFilterId}
                onChange={(e) => setOrgFilter(e.target.value)}
                className="min-w-[220px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">Select organization…</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-amber-700">
                Super admins must pick an org so new staff are created under that tenant (not your own org).
              </p>
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, staff ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <button
            type="button"
            disabled={isSuper && !orgFilterId}
            onClick={() => {
              setBulkText(CSV_TEMPLATE);
              setShowBulkModal(true);
            }}
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload className="h-4 w-4" /> Bulk import (CSV)
          </button>
          <button
            disabled={isSuper && !orgFilterId}
            onClick={() => {
              setEditingEmployee(null);
              setShowModal(true);
            }}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add Employee
          </button>
        </div>
      </div>

      {isSuper && !orgFilterId && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Choose an organization to list and manage its employees.
        </div>
      )}

      <div className="rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                {isSuper && <th className="px-4 py-3">Organization</th>}
                <th className="px-4 py-3">Staff ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">RFID</th>
                <th className="px-4 py-3">Fuel Type</th>
                <th className="px-4 py-3">Allotment</th>
                <th className="px-4 py-3">Quota</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isSuper ? 10 : 9} className="py-10 text-center">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={isSuper ? 10 : 9} className="py-10 text-center text-gray-400">
                    No employees found
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="border-b last:border-0 hover:bg-gray-50">
                    {isSuper && (
                      <td className="px-4 py-3 text-gray-600">{emp.organization?.name || '—'}</td>
                    )}
                    <td className="px-4 py-3 font-medium">{emp.staffId}</td>
                    <td className="px-4 py-3">
                      {emp.firstName} {emp.lastName}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{emp.rfidUid || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          emp.fuelType === 'PMS'
                            ? 'bg-orange-100 text-orange-700'
                            : emp.fuelType === 'AGO'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-teal-100 text-teal-700'
                        }`}
                      >
                        {emp.fuelType || 'PMS'}
                      </span>
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-gray-600" title={emp.allotmentCategory || ''}>
                      {emp.allotmentCategory || '—'}
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
                        <button
                          onClick={() => {
                            setEditingEmployee(emp);
                            setShowModal(true);
                          }}
                          className="rounded px-2 py-1 text-xs text-primary-600 hover:bg-primary-50"
                        >
                          Edit
                        </button>
                        {emp.rfidUid && emp.cardStatus === 'ACTIVE' && (
                          <button
                            onClick={() => handleBlock(emp.rfidUid!, 'BLOCKED')}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          >
                            <ShieldOff className="h-3 w-3" /> Block
                          </button>
                        )}
                        {emp.rfidUid && emp.cardStatus === 'BLOCKED' && (
                          <button
                            onClick={() => handleBlock(emp.rfidUid!, 'ACTIVE')}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-green-600 hover:bg-green-50"
                          >
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
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-50">
              Previous
            </button>
            <span className="text-gray-500">
              Page {page} of {totalPages}
            </span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-50">
              Next
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <EmployeeModal
          employee={editingEmployee}
          isSuperAdmin={isSuper}
          onClose={() => {
            setShowModal(false);
            setEditingEmployee(null);
          }}
          onSave={handleSave}
        />
      )}

      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold">Bulk import employees</h2>
            <p className="mb-3 text-xs text-gray-600">
              Paste CSV with header: staffId, firstName, lastName, phone, email, rfidUid, quotaType, quotaNaira, quotaLiters,
              fuelType, allotmentCategory, pin. Required columns: staffId, firstName, lastName.
            </p>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={14}
              className="mb-3 w-full rounded-lg border font-mono text-xs"
            />
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setBulkText(CSV_TEMPLATE)} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
                Reset template
              </button>
              <button type="button" onClick={() => setShowBulkModal(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkRunning}
                onClick={runBulkImport}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {bulkRunning ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmployeeModal({
  employee,
  isSuperAdmin,
  onClose,
  onSave,
}: {
  employee: Employee | null;
  isSuperAdmin: boolean;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
}) {
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
    allotmentCategory: employee?.allotmentCategory || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name.includes('quota') && name !== 'quotaType' ? parseFloat(value) || 0 : value,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold">{employee ? 'Edit Employee' : 'Add Employee'}</h2>
        {isSuperAdmin && !employee && (
          <p className="mb-3 text-xs text-amber-800">New employees use the organization selected on the Employees page.</p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const payload: Record<string, unknown> = { ...form };
            if (payload.allotmentCategory === '') payload.allotmentCategory = null;
            onSave(payload);
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600">Staff ID</label>
              <input
                name="staffId"
                value={form.staffId}
                onChange={handleChange}
                required
                disabled={!!employee}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
              />
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-600">Fuel type</label>
              <select name="fuelType" value={form.fuelType} onChange={handleChange} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                <option value="PMS">PMS (Petrol)</option>
                <option value="AGO">AGO (Diesel)</option>
                <option value="CNG">CNG (Gas)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Quota type</label>
              <select name="quotaType" value={form.quotaType} onChange={handleChange} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                <option value="NAIRA">Naira (₦)</option>
                <option value="LITERS">Liters (L)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Fuel allotment category</label>
            <input
              name="allotmentCategory"
              value={form.allotmentCategory}
              onChange={handleChange}
              placeholder="e.g. Fleet pool A, Executive, Contractor"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
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
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
