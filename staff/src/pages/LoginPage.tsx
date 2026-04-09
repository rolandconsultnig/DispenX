import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Fuel } from 'lucide-react';

export default function LoginPage() {
  const { employee, login } = useAuth();
  const navigate = useNavigate();
  const [staffId, setStaffId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  if (employee) { navigate('/', { replace: true }); return null; }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(staffId, pin);
      toast.success('Welcome!');
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 rounded-full bg-primary-100 p-3"><Fuel className="h-8 w-8 text-primary-600" /></div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Portal</h1>
          <p className="text-sm text-gray-500">Sign in with your Staff ID and PIN</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Staff ID</label>
            <input value={staffId} onChange={e => setStaffId(e.target.value)} required placeholder="EMP-001"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">PIN</label>
            <input type="password" value={pin} onChange={e => setPin(e.target.value)} required maxLength={6} placeholder="••••"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm tracking-widest focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
