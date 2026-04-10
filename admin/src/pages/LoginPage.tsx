import { useState, FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl md:min-h-[calc(100vh-3rem)] md:grid-cols-2">
        <div className="relative hidden p-10 md:block lg:p-14">
          <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200">
                <img src="/energydispenx-logo.png" alt="EnergyDispenX" className="h-7 w-auto rounded" />
                EnergyDispenX
              </div>
              <h1 className="text-4xl font-bold leading-tight text-white xl:text-5xl">
                Real-time fuel operations intelligence for modern fleets
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-6 text-slate-300">
                Track cards, monitor settlements, and manage station performance from one secure enterprise-grade control center.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-slate-400">Monitoring</p>
                <p className="mt-1 text-xl font-semibold text-white">24/7</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-slate-400">Operations</p>
                <p className="mt-1 text-xl font-semibold text-white">Realtime</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-slate-400">Settlement Accuracy</p>
                <p className="mt-1 text-xl font-semibold text-white">99.9%</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-slate-400">Fleet Visibility</p>
                <p className="mt-1 text-xl font-semibold text-white">Live</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center bg-white p-6 sm:p-10">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <img src="/energydispenx-logo.png" alt="EnergyDispenX logo" className="mb-4 h-12 w-auto rounded-lg" />
              <h2 className="text-2xl font-bold text-slate-900">Sign in to Admin Console</h2>
              <p className="mt-1 text-sm text-slate-500">Use your admin credentials to continue.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="admin@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-500">
              Protected by role-based access and transaction-safe workflows.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
