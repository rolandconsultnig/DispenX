import { useEffect, useMemo, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

type FuelType = 'PMS' | 'AGO' | 'CNG';

const cardClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';

function Hero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="rounded-2xl bg-gradient-to-r from-brand-600 via-brand-500 to-violet-500 p-6 text-white shadow-lg">
      <p className="text-xs uppercase tracking-widest text-indigo-100">EnergyDispenX Station</p>
      <h1 className="mt-1 text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-indigo-100">{subtitle}</p>
    </section>
  );
}

function StationLoginPanel({
  title,
  subtitle,
  apiKey,
  setApiKey,
  onLogin,
  error,
}: {
  title: string;
  subtitle: string;
  apiKey: string;
  setApiKey: (v: string) => void;
  onLogin: () => void;
  error: string;
}) {
  return (
    <section className={cardClass}>
      <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 md:grid-cols-2">
        <div className="relative hidden p-8 md:block">
          <div className="absolute -left-20 top-0 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200">
                <span aria-hidden>⛽</span>
                Station Access
              </div>
              <h2 className="text-2xl font-bold leading-tight text-white">Secure station operations gateway</h2>
              <p className="mt-3 text-sm text-slate-300">Authenticate this terminal before scanning or confirming fuel requests.</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <img src="/energydispenx-logo.png" alt="EnergyDispenX" className="h-10 w-auto rounded-lg" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-4 space-y-3">
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="cfms_station_a_dev_key_001"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <button
              type="button"
              onClick={onLogin}
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Login
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </section>
  );
}

function formatQrAmount(info: {
  employee?: { quotaType?: string };
  amountNaira?: number | null;
  amountLiters?: number | null;
}) {
  if (info?.employee?.quotaType === 'LITERS' && info.amountLiters != null && Number(info.amountLiters) > 0) {
    return `${Number(info.amountLiters).toFixed(1)} L`;
  }
  return `₦${Number(info.amountNaira || 0).toLocaleString()}`;
}

function ConfirmPage({ token }: { token: string }) {
  const [stationToken, setStationToken] = useState<string | null>(localStorage.getItem('cfms_station_token'));
  const [station, setStation] = useState<unknown>(() => JSON.parse(localStorage.getItem('cfms_station_info') || 'null'));
  const [apiKey, setApiKey] = useState('');
  const [tokenInfo, setTokenInfo] = useState<Record<string, unknown> | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [infoError, setInfoError] = useState('');
  const [staffPin, setStaffPin] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/station-portal/token-info/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Invalid QR code');
        setTokenInfo(data.data);
      })
      .catch((err: Error) => setInfoError(err.message || 'Failed to load QR details'))
      .finally(() => setInfoLoading(false));
  }, [token]);

  async function loginStation() {
    try {
      const res = await fetch('/api/station-portal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Station login failed');
      localStorage.setItem('cfms_station_token', data.data.token);
      localStorage.setItem('cfms_station_info', JSON.stringify(data.data.station));
      setStationToken(data.data.token);
      setStation(data.data.station);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  async function confirmDispense() {
    if (!stationToken || !staffPin.trim()) return setError('Staff PIN is required');
    setConfirming(true);
    setError('');
    try {
      const res = await fetch('/api/station-portal/confirm-dispense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${stationToken}` },
        body: JSON.stringify({ token, pin: staffPin }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Confirmation failed');
      setResult(data.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Confirmation failed');
    } finally {
      setConfirming(false);
    }
  }

  const st = station as { name?: string; location?: string } | null;

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-5xl gap-5 p-4 md:p-6">
      <Hero title="Confirm Dispense" subtitle="Staff PIN confirmation before fueling." />
      {infoLoading && (
        <section className={cardClass}>
          <p className="text-sm text-slate-500">Loading transaction details...</p>
        </section>
      )}
      {!infoLoading && infoError && (
        <section className={cardClass}>
          <p className="text-sm text-red-600">{infoError}</p>
        </section>
      )}
      {!infoLoading && !infoError && result && (
        <section className={cardClass}>
          <h2 className="text-lg font-semibold text-emerald-700">Fuel Dispensed Successfully</h2>
          <p className="mt-2 text-sm text-slate-600">
            Amount: ₦{Number(result.amountNaira).toLocaleString()} • {Number(result.amountLiters).toFixed(2)}L
          </p>
        </section>
      )}
      {!infoLoading && !infoError && !result && !stationToken && (
        <StationLoginPanel
          title="Station Login Required"
          subtitle="Log in to confirm fuel dispense."
          apiKey={apiKey}
          setApiKey={setApiKey}
          onLogin={loginStation}
          error={error}
        />
      )}
      {!infoLoading && !infoError && !result && stationToken && (
        <section className={cardClass}>
          <h2 className="text-lg font-semibold">Confirm Fuel Dispense</h2>
          <p className="text-sm text-slate-500">
            {st?.name} {st?.location ? `• ${st.location}` : ''}
          </p>
          <p className="mt-2 text-sm text-slate-600">Requested amount: {formatQrAmount(tokenInfo as Parameters<typeof formatQrAmount>[0])}</p>
          <input
            value={staffPin}
            onChange={(e) => setStaffPin(e.target.value)}
            placeholder="Staff PIN"
            className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={confirmDispense}
            disabled={confirming}
            className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            {confirming ? 'Confirming...' : 'Confirm & Dispense'}
          </button>
        </section>
      )}
    </main>
  );
}

function StationPortal() {
  const [apiKey, setApiKey] = useState('');
  const [stationToken, setStationToken] = useState<string | null>(localStorage.getItem('cfms_station_token'));
  const [station, setStation] = useState<unknown>(() => JSON.parse(localStorage.getItem('cfms_station_info') || 'null'));
  const [qrInput, setQrInput] = useState('');
  const [confirmLink, setConfirmLink] = useState('');
  const [scanResult, setScanResult] = useState<Record<string, unknown> | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [dispensing, setDispensing] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [fuelType, setFuelType] = useState<FuelType>('PMS');
  const [amountNaira, setAmountNaira] = useState('');
  const [amountLiters, setAmountLiters] = useState('');

  useEffect(() => {
    if (!cameraOn || !stationToken) return;
    const scanner = new Html5Qrcode('qr-reader');
    scannerRef.current = scanner;
    scanner
      .start({ facingMode: 'environment' }, { fps: 10, qrbox: 250 }, (decodedText) => {
        setQrInput(decodedText);
        setCameraOn(false);
      }, () => {})
      .catch(() => setCameraOn(false));
    return () => {
      scannerRef.current?.stop().catch(() => {}).finally(() => scannerRef.current?.clear());
    };
  }, [cameraOn, stationToken]);

  async function loginStation() {
    try {
      const res = await fetch('/api/station-portal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Station login failed');
      localStorage.setItem('cfms_station_token', data.data.token);
      localStorage.setItem('cfms_station_info', JSON.stringify(data.data.station));
      setStationToken(data.data.token);
      setStation(data.data.station);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Station login failed');
    }
  }

  function logout() {
    localStorage.removeItem('cfms_station_token');
    localStorage.removeItem('cfms_station_info');
    setStationToken(null);
    setStation(null);
    setScanResult(null);
    setQrInput('');
    setConfirmLink('');
  }

  async function scanQr() {
    if (!stationToken || !qrInput.trim()) return;
    setScanLoading(true);
    setError('');
    try {
      const res = await fetch('/api/station-portal/scan-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${stationToken}` },
        body: JSON.stringify({ qrData: qrInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Unable to scan QR');
      setScanResult(data.data);
      setConfirmLink(`${window.location.origin}/confirm?token=${encodeURIComponent(data.data.token)}`);
      const ft = (data.data.fuelType || data.data.employee?.fuelType || 'PMS') as FuelType;
      setFuelType(ft);
      if (data.data.employee?.quotaType === 'LITERS') {
        setAmountNaira('');
        setAmountLiters(data.data.amountLiters != null ? String(data.data.amountLiters) : '');
      } else {
        setAmountNaira(data.data.amountNaira ? String(data.data.amountNaira) : '');
        setAmountLiters('');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to scan QR');
    } finally {
      setScanLoading(false);
    }
  }

  async function dispense() {
    if (!stationToken || !scanResult?.token) return;
    setDispensing(true);
    setError('');
    try {
      const idempotencyKey = `station-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const emp = scanResult.employee as { quotaType?: string };
      const payload: Record<string, unknown> = {
        token: scanResult.token,
        idempotencyKey,
        fuelType,
      };
      if (emp?.quotaType === 'NAIRA') payload.amountNaira = Number(amountNaira || 0);
      else payload.amountLiters = Number(amountLiters || 0);

      const res = await fetch('/api/station-portal/dispense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${stationToken}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Dispense failed');
      setScanResult({ ...scanResult, completed: true, transaction: data.data });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Dispense failed');
    } finally {
      setDispensing(false);
    }
  }

  const balanceLabel = useMemo(() => {
    const emp = scanResult?.employee as { quotaType?: string; balanceNaira?: number; balanceLiters?: number } | undefined;
    if (!emp) return '';
    return emp.quotaType === 'NAIRA'
      ? `₦${Number(emp.balanceNaira || 0).toLocaleString()}`
      : `${Number(emp.balanceLiters || 0).toLocaleString()}L`;
  }, [scanResult]);

  const st = station as { name?: string; location?: string } | null;

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl gap-5 p-4 md:p-6">
      <Hero title="Attendant Portal" subtitle="Scan, verify, and complete fuel dispensing securely." />
      {!stationToken ? (
        <StationLoginPanel
          title="Station Login"
          subtitle="Use station API key to start attendant operations."
          apiKey={apiKey}
          setApiKey={setApiKey}
          onLogin={loginStation}
          error={error}
        />
      ) : (
        <>
          <section className={cardClass}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{st?.name || 'Station'}</h2>
                <p className="text-sm text-slate-500">{st?.location || 'No location specified'}</p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Logout
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
              <input
                className="xl:col-span-6 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder="Paste scanned QR payload"
              />
              <button
                type="button"
                className="xl:col-span-3 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
                onClick={() => setCameraOn((v) => !v)}
              >
                {cameraOn ? 'Stop Camera' : 'Open Camera'}
              </button>
              <button
                type="button"
                className="xl:col-span-3 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                onClick={scanQr}
                disabled={scanLoading}
              >
                {scanLoading ? 'Scanning...' : 'Scan QR'}
              </button>
            </div>
            {cameraOn && <div id="qr-reader" className="mt-4 max-w-md rounded-xl border border-slate-200 p-3" />}
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </section>
          {scanResult && (
            <section className={cardClass}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Staff Identified</h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    scanResult.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {scanResult.completed ? 'DISPENSED' : 'READY'}
                </span>
              </div>
              {(() => {
                const emp = scanResult.employee as {
                  firstName?: string;
                  lastName?: string;
                  staffId?: string;
                  quotaType?: string;
                };
                return (
                  <>
                    <p className="text-sm">
                      <span className="font-semibold">
                        {emp?.firstName} {emp?.lastName}
                      </span>{' '}
                      ({emp?.staffId})
                    </p>
                    <p className="mt-1 text-sm text-slate-500">Balance: {balanceLabel}</p>
                  </>
                );
              })()}
              {confirmLink && (
                <p className="mt-1 text-xs text-slate-500">
                  Confirm:{' '}
                  <a className="text-brand-600 underline" href={confirmLink} target="_blank" rel="noreferrer">
                    {confirmLink}
                  </a>
                </p>
              )}
              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Fuel Type</label>
                  <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value as FuelType)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="PMS">PMS</option>
                    <option value="AGO">AGO</option>
                    <option value="CNG">CNG</option>
                  </select>
                </div>
                {(scanResult.employee as { quotaType?: string })?.quotaType === 'NAIRA' ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Amount (₦)</label>
                    <input
                      type="number"
                      min={1}
                      value={amountNaira}
                      onChange={(e) => setAmountNaira(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Amount (L)</label>
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={amountLiters}
                      onChange={(e) => setAmountLiters(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>
              {!scanResult.completed && (
                <button
                  type="button"
                  onClick={dispense}
                  disabled={dispensing}
                  className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {dispensing ? 'Dispensing...' : 'Proceed to Dispense'}
                </button>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const confirmToken = params.get('token');
  const isConfirm = window.location.pathname === '/confirm' && confirmToken;
  return isConfirm ? <ConfirmPage token={confirmToken} /> : <StationPortal />;
}
