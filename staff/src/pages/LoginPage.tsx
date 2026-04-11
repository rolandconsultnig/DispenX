import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import toast from 'react-hot-toast';

type Org = { id: string; name: string };

export default function LoginPage() {
  const { employee, login } = useAuth();
  const navigate = useNavigate();
  const [staffId, setStaffId] = useState('');
  const [pin, setPin] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get('/organizations')
      .then((res) => {
        const list: Org[] = res.data?.data ?? [];
        setOrgs(list);
        if (list.length === 1) setOrganizationId(list[0].id);
      })
      .catch(() => {
        toast.error('Could not load organizations. Check your connection.');
      })
      .finally(() => setOrgsLoading(false));
  }, []);

  if (employee) {
    navigate('/', { replace: true });
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (orgs.length > 1 && !organizationId) {
      toast.error('Select your organization.');
      return;
    }
    const trimmedPin = pin.trim();
    if (trimmedPin.length < 4 || trimmedPin.length > 6) {
      toast.error('PIN must be 4–6 characters.');
      return;
    }
    setLoading(true);
    try {
      await login(staffId.trim(), trimmedPin, organizationId || undefined);
      toast.success('Welcome!');
      navigate('/');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl md:min-h-[calc(100vh-3rem)] md:grid-cols-2">
        <div className="relative hidden p-10 md:block lg:p-14">
          <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200">
                <img src="/energydispenx-logo.png" alt="EnergyDispenX" className="h-7 w-auto rounded" />
                EnergyDispenX Staff
              </div>
              <h1 className="text-4xl font-bold leading-tight text-white xl:text-5xl">
                Fleet operations made simple for every team member
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-6 text-slate-300">
                View transactions, recharges, disputes, and profile tools from a fast and secure staff workspace.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-slate-400">Daily Workflows</p>
                <p className="mt-1 text-xl font-semibold text-white">Streamlined</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-slate-400">Response Time</p>
                <p className="mt-1 text-xl font-semibold text-white">Realtime</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center bg-white p-6 sm:p-10">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <img src="/energydispenx-logo.png" alt="EnergyDispenX logo" className="mb-4 h-12 w-auto rounded-lg" />
              <h2 className="text-2xl font-bold text-slate-900">Sign in to Staff Portal</h2>
              <p className="mt-1 text-sm text-slate-500">Use your Staff ID and PIN to continue.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {orgs.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">Organization</label>
                  <select
                    value={organizationId}
                    onChange={(e) => setOrganizationId(e.target.value)}
                    required
                    disabled={orgsLoading}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
                  >
                    <option value="">{orgsLoading ? 'Loading…' : 'Select organization'}</option>
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700">Staff ID</label>
                <input
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="EMP-001"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">PIN</label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  required
                  minLength={4}
                  maxLength={6}
                  autoComplete="current-password"
                  placeholder="••••"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm tracking-widest shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <p className="mt-1 text-xs text-slate-500">4–6 digits (same as mobile app).</p>
              </div>
              <button
                type="submit"
                disabled={loading || orgsLoading}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              <Link to="/download" className="font-medium text-blue-600 hover:text-blue-500">
                Download mobile app (APK)
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
