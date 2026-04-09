import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Fuel, Activity, KeyRound, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import { Station } from '../types';

export default function PetrolStationPortalPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/stations')
      .then((res) => setStations(res.data.data))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const active = stations.filter((s) => s.isActive).length;
    const avgPms = stations.length ? stations.reduce((sum, s) => sum + s.pricePms, 0) / stations.length : 0;
    const avgAgo = stations.length ? stations.reduce((sum, s) => sum + s.priceAgo, 0) / stations.length : 0;
    const avgCng = stations.length ? stations.reduce((sum, s) => sum + s.priceCng, 0) / stations.length : 0;
    return { active, avgPms, avgAgo, avgCng };
  }, [stations]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Petrol Station Portal</h1>
          <p className="text-sm text-gray-500">Monitor station network health, prices and transaction readiness.</p>
        </div>
        <Link to="/stations" className="w-fit rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
          Open Station Manager
        </Link>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Stations" value={stations.length.toLocaleString()} icon={Fuel} color="bg-blue-500" />
        <StatCard label="Active" value={stats.active.toLocaleString()} icon={Activity} color="bg-green-500" />
        <StatCard label="Avg PMS Price" value={`₦${stats.avgPms.toFixed(0)}`} icon={Fuel} color="bg-orange-500" />
        <StatCard label="Avg AGO/CNG" value={`₦${stats.avgAgo.toFixed(0)} / ₦${stats.avgCng.toFixed(0)}`} icon={Fuel} color="bg-purple-500" />
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3">Station</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">PMS</th>
                <th className="px-4 py-3">AGO</th>
                <th className="px-4 py-3">CNG</th>
                <th className="px-4 py-3">Transactions</th>
                <th className="px-4 py-3">API Key</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                  </td>
                </tr>
              ) : stations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-gray-400">No stations found.</td>
                </tr>
              ) : (
                stations.map((station) => (
                  <tr key={station.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{station.name}</td>
                    <td className="px-4 py-3">{station.location || station.address || '—'}</td>
                    <td className="px-4 py-3">₦{station.pricePms}</td>
                    <td className="px-4 py-3">₦{station.priceAgo}</td>
                    <td className="px-4 py-3">₦{station.priceCng}</td>
                    <td className="px-4 py-3">{station._count?.transactions || 0}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                        <KeyRound className="h-3 w-3" />
                        {station.apiKey ? 'Available' : 'Missing'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        station.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {station.isActive ? 'Active' : 'Inactive'}
                      </span>
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
