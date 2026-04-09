import { useEffect, useMemo, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import './App.css';

type FuelType = 'PMS' | 'AGO' | 'CNG';

function App() {
  const [apiKey, setApiKey] = useState('');
  const [stationToken, setStationToken] = useState<string | null>(localStorage.getItem('cfms_station_token'));
  const [station, setStation] = useState<any>(() => {
    const raw = localStorage.getItem('cfms_station_info');
    return raw ? JSON.parse(raw) : null;
  });

  const [qrInput, setQrInput] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [dispensing, setDispensing] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const [fuelType, setFuelType] = useState<FuelType>('PMS');
  const [amountNaira, setAmountNaira] = useState('');
  const [amountLiters, setAmountLiters] = useState('');

  useEffect(() => {
    if (!cameraOn || !stationToken) return;
    const scannerId = 'qr-reader';
    const scanner = new Html5Qrcode(scannerId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          setQrInput(decodedText);
          setCameraOn(false);
        },
        () => {}
      )
      .catch(() => {
        setCameraOn(false);
      });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).finally(() => scannerRef.current?.clear());
      }
    };
  }, [cameraOn, stationToken]);

  async function loginStation() {
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
  }

  function logout() {
    localStorage.removeItem('cfms_station_token');
    localStorage.removeItem('cfms_station_info');
    setStationToken(null);
    setStation(null);
    setScanResult(null);
  }

  async function scanQr() {
    if (!stationToken || !qrInput.trim()) return;
    setScanLoading(true);
    setScanResult(null);
    try {
      const res = await fetch('/api/station-portal/scan-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${stationToken}`,
        },
        body: JSON.stringify({ qrData: qrInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Unable to scan QR');
      setScanResult(data.data);
      setFuelType((data.data.recommended?.fuelType || data.data.employee?.fuelType || 'PMS') as FuelType);
      setAmountNaira(data.data.recommended?.amountNaira ? String(data.data.recommended.amountNaira) : '');
      setAmountLiters(data.data.recommended?.amountLiters ? String(data.data.recommended.amountLiters) : '');
    } finally {
      setScanLoading(false);
    }
  }

  async function dispense() {
    if (!stationToken || !scanResult?.token) return;
    setDispensing(true);
    try {
      const idempotencyKey = `station-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const payload: any = { token: scanResult.token, idempotencyKey, fuelType };
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
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Dispense failed');
      setScanResult({ ...scanResult, completed: true, transaction: data.data });
    } finally {
      setDispensing(false);
    }
  }

  const balanceLabel = useMemo(() => {
    if (!scanResult?.employee) return '';
    return scanResult.employee.quotaType === 'NAIRA'
      ? `₦${Number(scanResult.employee.balanceNaira || 0).toLocaleString()}`
      : `${Number(scanResult.employee.balanceLiters || 0).toLocaleString()}L`;
  }, [scanResult]);

  if (!stationToken) {
    return (
      <main className="page">
        <section className="card">
          <h1>Petrol Station Portal</h1>
          <p className="muted">Login with station API key</p>
          <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="cfms_station_a_dev_key_001" />
          <button onClick={loginStation}>Login</button>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="card">
        <div className="row between">
          <div>
            <h1>Petrol Station Portal</h1>
            <p className="muted">{station?.name} {station?.location ? `• ${station.location}` : ''}</p>
          </div>
          <button className="ghost" onClick={logout}>Logout</button>
        </div>

        <h3>Scan Staff QR</h3>
        <div className="row">
          <input value={qrInput} onChange={(e) => setQrInput(e.target.value)} placeholder="Paste scanned QR payload" />
          <button className="secondary" onClick={() => setCameraOn((v) => !v)}>{cameraOn ? 'Stop Camera' : 'Open Camera'}</button>
          <button onClick={scanQr} disabled={scanLoading}>{scanLoading ? 'Scanning...' : 'Scan QR'}</button>
        </div>
        {cameraOn && <div id="qr-reader" className="qr-reader" />}
      </section>

      {scanResult && (
        <section className="card">
          <div className="row between">
            <h3>Staff Identified</h3>
            <span className={`badge ${scanResult.completed ? 'ok' : 'warn'}`}>{scanResult.completed ? 'DISPENSED' : 'READY'}</span>
          </div>
          <p><strong>{scanResult.employee.firstName} {scanResult.employee.lastName}</strong> ({scanResult.employee.staffId})</p>
          <p className="muted">Balance: {balanceLabel}</p>

          <div className="row cols3">
            <div>
              <label>Fuel Type</label>
              <select value={fuelType} onChange={(e) => setFuelType(e.target.value as FuelType)}>
                <option value="PMS">PMS</option>
                <option value="AGO">AGO</option>
                <option value="CNG">CNG</option>
              </select>
            </div>

            {scanResult.employee.quotaType === 'NAIRA' ? (
              <div>
                <label>Amount (₦)</label>
                <input type="number" min="1" value={amountNaira} onChange={(e) => setAmountNaira(e.target.value)} />
              </div>
            ) : (
              <div>
                <label>Amount (L)</label>
                <input type="number" min="0.1" step="0.1" value={amountLiters} onChange={(e) => setAmountLiters(e.target.value)} />
              </div>
            )}
          </div>

          {!scanResult.completed && (
            <button onClick={dispense} disabled={dispensing}>{dispensing ? 'Dispensing...' : 'Dispense Fuel'}</button>
          )}
        </section>
      )}
    </main>
  );
}

export default App;
