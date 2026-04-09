import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Organization } from '../types';
import { Plus, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);

  const fetchOrgs = () => {
    setLoading(true);
    api.get('/organizations').then((res) => { setOrgs(res.data.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchOrgs(); }, []);

  const handleSave = async (formData: any) => {
    try {
      if (editing) {
        await api.put(`/organizations/${editing.id}`, formData);
        toast.success('Organization updated');
      } else {
        await api.post('/organizations', formData);
        toast.success('Organization created');
      }
      setShowModal(false);
      setEditing(null);
      fetchOrgs();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
          <Plus className="h-4 w-4" /> Add Organization
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex justify-center py-20"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : orgs.length === 0 ? (
          <div className="col-span-full text-center text-gray-400 py-20">No organizations found</div>
        ) : (
          orgs.map((org) => (
            <div key={org.id} className="rounded-xl bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900">{org.name}</h3>
              <p className="text-sm text-gray-500">{org.address || '—'}</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Credit Limit</span>
                  <span className="font-semibold">₦{org.creditLimit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Employees</span>
                  <span className="font-semibold">{org._count?.employees || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Settlement Cycle</span>
                  <span className="font-semibold">{org.settlementCycleDays} days</span>
                </div>
              </div>
              <button onClick={() => { setEditing(org); setShowModal(true); }} className="mt-4 w-full rounded-lg border py-1.5 text-xs font-medium hover:bg-gray-50">Edit</button>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <OrgModal org={editing} onClose={() => { setShowModal(false); setEditing(null); }} onSave={handleSave} />
      )}
    </div>
  );
}

function OrgModal({ org, onClose, onSave }: { org: Organization | null; onClose: () => void; onSave: (data: any) => void }) {
  const [form, setForm] = useState({
    name: org?.name || '',
    address: org?.address || '',
    phone: org?.phone || '',
    email: org?.email || '',
    creditLimit: org?.creditLimit || 0,
    settlementCycleDays: org?.settlementCycleDays || 30,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: ['creditLimit', 'settlementCycleDays'].includes(name) ? parseFloat(value) || 0 : value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold">{org ? 'Edit Organization' : 'Add Organization'}</h2>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600">Name</label>
            <input name="name" value={form.name} onChange={handleChange} required className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Address</label>
            <input name="address" value={form.address} onChange={handleChange} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600">Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Email</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600">Credit Limit (₦)</label>
              <input name="creditLimit" type="number" value={form.creditLimit} onChange={handleChange} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Settlement Cycle (days)</label>
              <input name="settlementCycleDays" type="number" value={form.settlementCycleDays} onChange={handleChange} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
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
