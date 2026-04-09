import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Fuel, Activity, KeyRound, RefreshCw, QrCode, CheckCircle2 } from 'lucide-react';
import api from '../lib/api';
import { Station } from '../types';

export default function PetrolStationPortalPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [stationToken, setStationToken] = useState<string | null>(null);
  const [stationApiKey, setStationApiKey] = useState('');
  const [stationInfo, setStationInfo] = useState<any>(null);

  const [qrData, setQrData] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [dispensing, setDispensing] = useState(false);
  const [amountNaira, setAmountNaira] = useState('');
  const [amountLiters, setAmountLiters] = useState('');
  const [fuelType, setFuelType] = useState<'PMS' | 'AGO' | 'CNG'>('PMS');

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

  async function loginStation() {
    if (!stationApiKey.trim()) return;
    const res = await fetch('/api/station-portal/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: stationApiKey.trim() }),
    });
    const body = await res.json();
    if (!res.ok || !body.success) throw new Error(body.message || 'Station login failed');
    setStationToken(body.data.token);
    setStationInfo(body.data.station);
    setFuelType((body.data.station?.pricePms ? 'PMS' : 'PMS') as 'PMS');
  }

  async function scanQr() {
    if (!stationToken || !qrData.trim()) return;
    setScanLoading(true);
    setScanResult(null);
    try {
      const res = await fetch('/api/station-portal/scan-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${stationToken}`,
        },
        body: JSON.stringify({ qrData: qrData.trim() }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || 'QR scan failed');
      setScanResult(body.data);
      setFuelType((body.data.recommended?.fuelType || body.data.employee?.fuelType || 'PMS') as 'PMS' | 'AGO' | 'CNG');
      setAmountNaira(body.data.recommended?.amountNaira ? String(body.data.recommended.amountNaira) : '');
      setAmountLiters(body.data.recommended?.amountLiters ? String(body.data.recommended.amountLiters) : '');
    } finally {
      setScanLoading(false);
    }
  }

  async function dispense() {
    if (!stationToken || !scanResult?.token) return;
    setDispensing(true);
    try {
      const idempotencyKey = `dispense-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const payload: any = {
        token: scanResult.token,
        idempotencyKey,
        fuelType,
      };
      if (scanResult.employee.quotaType === 'NAIRA') payload.amountNaira = Number(amountNaira || 0);
      else payload.amountLiters = Number(amountLiters || 0);

      const res = await fetch('/api/station-portal/dispense', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${stationToken}`,
        },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || 'Dispense failed');

      setScanResult({ ...scanResult, completed: true, transaction: body.data });
    } finally {
      setDispensing(false);
    }
  }

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

      <div className="mb-6 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Attendant Workflow</h2>
        {!stationToken ? (
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              value={stationApiKey}
              onChange={(e) => setStationApiKey(e.target.value)}
              placeholder="Enter station API key to login attendant platform"
              className="rounded-lg border px-3 py-2 text-sm"
            />
            <button onClick={loginStation} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
              Login Station
            </button>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-sm text-gray-600">
              Logged in as <span className="font-semibold">{stationInfo?.name}</span>. Scan staff QR, confirm amount, then click dispense.
            </p>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={qrData}
                onChange={(e) => setQrData(e.target.value)}
                placeholder="Paste/scan QR payload here"
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <button
                onClick={scanQr}
                disabled={scanLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {scanLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                Scan QR
              </button>
            </div>

            {scanResult && (
              <div className="mt-4 rounded-lg border bg-gray-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold text-gray-900">
                    {scanResult.employee.firstName} {scanResult.employee.lastName} ({scanResult.employee.staffId})
                  </p>
                  {scanResult.completed ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      <CheckCircle2 className="h-3 w-3" /> Dispensed
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Awaiting dispense</span>
                  )}
                </div>
                <p className="mb-2 text-xs text-gray-500">
                  Balance: {scanResult.employee.quotaType === 'NAIRA'
                    ? `₦${scanResult.employee.balanceNaira.toLocaleString()}`
                    : `${scanResult.employee.balanceLiters.toLocaleString()}L`}
                </p>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Fuel Type</label>
                    <select value={fuelType} onChange={(e) => setFuelType(e.target.value as 'PMS' | 'AGO' | 'CNG')} className="w-full rounded-lg border px-2 py-1.5 text-sm">
                      <option value="PMS">PMS</option>
                      <option value="AGO">AGO</option>
                      <option value="CNG">CNG</option>
                    </select>
                  </div>
                  {scanResult.employee.quotaType === 'NAIRA' ? (
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-gray-600">Confirm amount (₦)</label>
                      <input type="number" min="1" value={amountNaira} onChange={(e) => setAmountNaira(e.target.value)} className="w-full rounded-lg border px-2 py-1.5 text-sm" />
                    </div>
                  ) : (
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-gray-600">Confirm amount (Liters)</label>
                      <input type="number" min="0.1" step="0.1" value={amountLiters} onChange={(e) => setAmountLiters(e.target.value)} className="w-full rounded-lg border px-2 py-1.5 text-sm" />
                    </div>
                  )}
                </div>

                {!scanResult.completed && (
                  <button
                    onClick={dispense}
                    disabled={dispensing}
                    className="mt-3 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    {dispensing ? 'Dispensing...' : 'Dispense Fuel'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
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
