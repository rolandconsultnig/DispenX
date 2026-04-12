import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Station, StationAttendantRow } from '../types';
import { Plus, Copy, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StationsPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Station | null>(null);

  const fetchStations = () => {
    setLoading(true);
    api.get('/stations').then((res) => { setStations(res.data.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchStations(); }, []);

  const handleSave = async (formData: any) => {
    try {
      if (editing) {
        await api.put(`/stations/${editing.id}`, formData);
        toast.success('Station updated');
      } else {
        await api.post('/stations', formData);
        toast.success('Station created');
      }
      setShowModal(false);
      setEditing(null);
      fetchStations();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const copyApiKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('API key copied');
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Petrol Stations</h1>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
          <Plus className="h-4 w-4" /> Add Station
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex justify-center py-20"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : stations.length === 0 ? (
          <div className="col-span-full text-center text-gray-400 py-20">No stations found</div>
        ) : (
          stations.map((s) => (
            <div key={s.id} className="rounded-xl bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{s.name}</h3>
                  <p className="text-xs font-mono text-primary-600">Code: {s.stationCode}</p>
                  <p className="text-sm text-gray-500">{s.location || s.address || '—'}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {s.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">PMS (Petrol)</span>
                  <span className="font-semibold">₦{s.pricePms}/L</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">AGO (Diesel)</span>
                  <span className="font-semibold">₦{s.priceAgo}/L</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">CNG (Gas)</span>
                  <span className="font-semibold">₦{s.priceCng}/L</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Transactions</span>
                  <span className="font-semibold">{s._count?.transactions || 0}</span>
                </div>
                {s.apiKey && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">API Key</span>
                    <button onClick={() => copyApiKey(s.apiKey!)} className="flex items-center gap-1 text-xs text-primary-600 hover:underline">
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => { setEditing(s); setShowModal(true); }} className="flex-1 rounded-lg border py-1.5 text-xs font-medium hover:bg-gray-50">Edit</button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <StationModal
          station={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function StationModal({ station, onClose, onSave }: { station: Station | null; onClose: () => void; onSave: (data: any) => void }) {
  const [form, setForm] = useState({
    stationCode: station?.stationCode || '',
    name: station?.name || '',
    location: station?.location || '',
    address: station?.address || '',
    phone: station?.phone || '',
    pricePms: station?.pricePms || 650,
    priceAgo: station?.priceAgo || 900,
    priceCng: station?.priceCng || 300,
  });
  const [attendants, setAttendants] = useState<StationAttendantRow[]>([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', displayName: '' });

  useEffect(() => {
    if (!station?.id) return;
    api.get(`/stations/${station.id}/attendants`).then((res) => {
      setAttendants(res.data.data as StationAttendantRow[]);
    }).catch(() => setAttendants([]));
  }, [station?.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numFields = ['pricePms', 'priceAgo', 'priceCng'];
    setForm((prev) => ({ ...prev, [name]: numFields.includes(name) ? parseFloat(value) || 0 : value }));
  };

  const addAttendant = async () => {
    if (!station?.id || !newUser.username.trim() || !newUser.password) {
      toast.error('Username and password required');
      return;
    }
    try {
      await api.post(`/stations/${station.id}/attendants`, {
        username: newUser.username.trim(),
        password: newUser.password,
        displayName: newUser.displayName.trim() || undefined,
      });
      toast.success('Attendant created');
      setNewUser({ username: '', password: '', displayName: '' });
      const res = await api.get(`/stations/${station.id}/attendants`);
      setAttendants(res.data.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const removeAttendant = async (id: string) => {
    if (!station?.id) return;
    if (!confirm('Remove this attendant?')) return;
    try {
      await api.delete(`/stations/${station.id}/attendants/${id}`);
      toast.success('Removed');
      setAttendants((a) => a.filter((x) => x.id !== id));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl my-8">
        <h2 className="mb-4 text-lg font-bold">{station ? 'Edit Station' : 'Add Station'}</h2>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600">Station code (for attendant login)</label>
            <input
              name="stationCode"
              value={form.stationCode}
              onChange={handleChange}
              required
              placeholder="e.g. LAG-01"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-mono uppercase"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Station Name</label>
            <input name="name" value={form.name} onChange={handleChange} required className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Location</label>
            <input name="location" value={form.location} onChange={handleChange} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
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
              <label className="block text-xs font-medium text-gray-600">PMS Price (₦/L)</label>
              <input name="pricePms" type="number" value={form.pricePms} onChange={handleChange} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600">AGO Price (₦/L)</label>
              <input name="priceAgo" type="number" value={form.priceAgo} onChange={handleChange} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">CNG Price (₦/L)</label>
              <input name="priceCng" type="number" value={form.priceCng} onChange={handleChange} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">Save</button>
          </div>
        </form>

        {station?.id && (
          <div className="mt-6 border-t border-gray-200 pt-4">
            <h3 className="text-sm font-bold text-gray-900">Station attendants</h3>
            <p className="text-xs text-gray-500 mt-1">Portal login: station code + username + password.</p>
            <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto text-sm">
              {attendants.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded border border-gray-100 px-2 py-1">
                  <span>{a.username}{a.displayName ? ` — ${a.displayName}` : ''}</span>
                  <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => removeAttendant(a.id)}>Remove</button>
                </li>
              ))}
              {attendants.length === 0 && <li className="text-gray-400 text-xs">No attendants yet.</li>}
            </ul>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <input placeholder="Username" value={newUser.username} onChange={(e) => setNewUser((n) => ({ ...n, username: e.target.value }))} className="rounded border px-2 py-1.5 text-sm" />
              <input placeholder="Password" type="password" value={newUser.password} onChange={(e) => setNewUser((n) => ({ ...n, password: e.target.value }))} className="rounded border px-2 py-1.5 text-sm" />
              <input placeholder="Display name (opt.)" value={newUser.displayName} onChange={(e) => setNewUser((n) => ({ ...n, displayName: e.target.value }))} className="rounded border px-2 py-1.5 text-sm" />
            </div>
            <button type="button" onClick={addAttendant} className="mt-2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700">
              Add attendant
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
