import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Fuel, CreditCard, QrCode, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function DashboardPage() {
  const { employee, refresh } = useAuth();
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [buying, setBuying] = useState(false);
  const [pin, setPin] = useState('');
  const [amountNaira, setAmountNaira] = useState('');
  const [amountLiters, setAmountLiters] = useState('');
  const [fuelType, setFuelType] = useState<'PMS' | 'AGO' | 'CNG'>('PMS');
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  if (!employee) return null;
  const currentEmployee = employee;

  const balance = currentEmployee.quotaType === 'NAIRA'
    ? `₦${currentEmployee.balanceNaira.toLocaleString()}`
    : `${currentEmployee.balanceLiters.toFixed(1)}L`;
  const quota = currentEmployee.quotaType === 'NAIRA'
    ? `₦${currentEmployee.quotaNaira.toLocaleString()}`
    : `${currentEmployee.quotaLiters.toFixed(1)}L`;
  const pct = currentEmployee.quotaType === 'NAIRA'
    ? (currentEmployee.quotaNaira > 0 ? (currentEmployee.balanceNaira / currentEmployee.quotaNaira) * 100 : 0)
    : (currentEmployee.quotaLiters > 0 ? (currentEmployee.balanceLiters / currentEmployee.quotaLiters) * 100 : 0);
  const barColor = pct > 50 ? 'bg-green-500' : pct > 20 ? 'bg-yellow-500' : 'bg-red-500';

  const fuelLabel: Record<string, string> = { PMS: 'Petrol (PMS)', AGO: 'Diesel (AGO)', CNG: 'CNG' };
  const selectedFuelType = useMemo<'PMS' | 'AGO' | 'CNG'>(() => {
    if (currentEmployee.fuelType === 'AGO' || currentEmployee.fuelType === 'CNG') return currentEmployee.fuelType;
    return 'PMS';
  }, [currentEmployee.fuelType]);

  useEffect(() => {
    setFuelType(selectedFuelType);
  }, [selectedFuelType]);

  async function handleBuyNow() {
    if (!pin.trim() || pin.length < 4) return;
    const naira = currentEmployee.quotaType === 'NAIRA' ? Number(amountNaira || 0) : 0;
    const liters = currentEmployee.quotaType === 'LITERS' ? Number(amountLiters || 0) : 0;
    if ((currentEmployee.quotaType === 'NAIRA' && naira <= 0) || (currentEmployee.quotaType === 'LITERS' && liters <= 0)) return;

    setBuying(true);
    try {
      const { data } = await api.post('/qr/generate', { pin });
      const token = data.data.token as string;
      const payload = {
        t: token,
        n: naira > 0 ? naira : undefined,
        l: liters > 0 ? liters : undefined,
        f: fuelType,
        x: data.data.expiresAt,
      };
      setQrPayload(JSON.stringify(payload));
      setExpiresAt(data.data.expiresAt);
      setShowBuyModal(false);
      setPin('');
      setAmountNaira('');
      setAmountLiters('');
      refresh();
    } finally {
      setBuying(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Allocation & Buy</h1>

      <div className="rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-primary-200">Your Allocation Balance</p>
            <p className="mt-1 text-3xl font-bold">{balance}</p>
            <p className="mt-1 text-sm text-primary-200">Total allocation: {quota}</p>
          </div>
          <Fuel className="h-12 w-12 text-primary-300" />
        </div>
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-primary-900/40">
            <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <p className="mt-1 text-xs text-primary-200">{pct.toFixed(0)}% remaining</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2"><Fuel className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Fuel Type</p>
              <p className="font-semibold text-gray-800">{fuelLabel[currentEmployee.fuelType] || currentEmployee.fuelType}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2"><CreditCard className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Card Status</p>
              <p className="font-semibold text-gray-800">{currentEmployee.cardStatus}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2"><CreditCard className="h-5 w-5 text-purple-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Quota Type</p>
              <p className="font-semibold text-gray-800">{currentEmployee.quotaType}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Buy Fuel</h2>
        <p className="mb-4 text-sm text-gray-500">
          Choose amount from your allocation and generate a QR code for the attendant to scan.
        </p>
        <button
          onClick={() => setShowBuyModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <QrCode className="h-4 w-4" />
          Buy Fuel
        </button>
      </div>

      {qrPayload && (
        <div className="rounded-lg border border-primary-200 bg-primary-50 p-6">
          <h3 className="mb-2 text-lg font-semibold text-primary-800">QR Generated</h3>
          <p className="mb-3 text-sm text-primary-700">
            Show this QR payload to attendant scanner. Expires at: {expiresAt ? new Date(expiresAt).toLocaleTimeString() : 'soon'}.
          </p>
          <div className="mb-3 flex justify-center rounded-md bg-white p-4 shadow-inner">
            <QRCodeSVG value={qrPayload} size={220} />
          </div>
          <div className="overflow-x-auto rounded-md bg-white p-3 font-mono text-xs text-gray-700 shadow-inner">
            {qrPayload}
          </div>
        </div>
      )}

      {showBuyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Select Allocation & Generate QR</h3>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Fuel Type</label>
                <select
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value as 'PMS' | 'AGO' | 'CNG')}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="PMS">PMS (Petrol)</option>
                  <option value="AGO">AGO (Diesel)</option>
                  <option value="CNG">CNG</option>
                </select>
              </div>

              {currentEmployee.quotaType === 'NAIRA' ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Amount (₦)</label>
                  <input
                    type="number"
                    min="1"
                    max={currentEmployee.balanceNaira}
                    value={amountNaira}
                    onChange={(e) => setAmountNaira(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder={`Max ₦${currentEmployee.balanceNaira.toLocaleString()}`}
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Amount (Liters)</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    max={currentEmployee.balanceLiters}
                    value={amountLiters}
                    onChange={(e) => setAmountLiters(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder={`Max ${currentEmployee.balanceLiters.toFixed(1)}L`}
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">PIN</label>
                <input
                  type="password"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm tracking-widest"
                  placeholder="Enter PIN"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowBuyModal(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleBuyNow}
                disabled={buying}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {buying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                Buy Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
