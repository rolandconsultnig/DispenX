import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [changingPin, setChangingPin] = useState(false);
  const [pinForm, setPinForm] = useState({ currentPin: '', newPin: '', confirmPin: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function changePin(e: React.FormEvent) {
    e.preventDefault();
    if (pinForm.newPin !== pinForm.confirmPin) { setMsg('PINs do not match'); return; }
    if (pinForm.newPin.length !== 4) { setMsg('PIN must be 4 digits'); return; }
    setSaving(true); setMsg('');
    try {
      await api.post('/change-pin', { currentPin: pinForm.currentPin, newPin: pinForm.newPin });
      setMsg('PIN changed successfully');
      setChangingPin(false);
      setPinForm({ currentPin: '', newPin: '', confirmPin: '' });
    } catch (err: any) {
      setMsg(err.response?.data?.error || 'Failed to change PIN');
    } finally { setSaving(false); }
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
            {user.firstName?.[0]}{user.lastName?.[0]}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{user.firstName} {user.lastName}</h2>
            <p className="text-sm text-gray-500">{user.staffId}</p>
          </div>
        </div>

        <div className="divide-y text-sm">
          <div className="flex justify-between py-3"><span className="text-gray-500">Email</span><span className="font-medium">{user.email || '—'}</span></div>
          <div className="flex justify-between py-3"><span className="text-gray-500">Phone</span><span className="font-medium">{user.phone || '—'}</span></div>
          <div className="flex justify-between py-3"><span className="text-gray-500">Department</span><span className="font-medium">{user.department || '—'}</span></div>
          <div className="flex justify-between py-3"><span className="text-gray-500">Organization</span><span className="font-medium">{user.organization?.name || '—'}</span></div>
          <div className="flex justify-between py-3"><span className="text-gray-500">Card Number</span><span className="font-medium">{user.cardNumber || '—'}</span></div>
          <div className="flex justify-between py-3"><span className="text-gray-500">Fuel Type</span><span className="font-medium">{user.fuelType || '—'}</span></div>
          <div className="flex justify-between py-3">
            <span className="text-gray-500">Balance</span>
            <span className="text-lg font-bold text-blue-600">₦{user.balance?.toLocaleString() || '0'}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Security</h3>
          <button onClick={() => setChangingPin(!changingPin)}
            className="text-sm font-medium text-blue-600 hover:text-blue-700">
            {changingPin ? 'Cancel' : 'Change PIN'}
          </button>
        </div>

        {changingPin && (
          <form onSubmit={changePin} className="mt-4 space-y-3">
            <input type="password" maxLength={4} placeholder="Current PIN" value={pinForm.currentPin}
              onChange={e => setPinForm(f => ({ ...f, currentPin: e.target.value.replace(/\D/g, '') }))}
              className="w-full rounded-lg border p-2 text-sm" required />
            <input type="password" maxLength={4} placeholder="New PIN" value={pinForm.newPin}
              onChange={e => setPinForm(f => ({ ...f, newPin: e.target.value.replace(/\D/g, '') }))}
              className="w-full rounded-lg border p-2 text-sm" required />
            <input type="password" maxLength={4} placeholder="Confirm New PIN" value={pinForm.confirmPin}
              onChange={e => setPinForm(f => ({ ...f, confirmPin: e.target.value.replace(/\D/g, '') }))}
              className="w-full rounded-lg border p-2 text-sm" required />
            <button type="submit" disabled={saving}
              className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Update PIN'}
            </button>
          </form>
        )}
        {msg && <p className={`mt-2 text-sm ${msg.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>}
      </div>

      <button onClick={logout} className="w-full rounded-lg border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
        Sign Out
      </button>
    </div>
  );
}
