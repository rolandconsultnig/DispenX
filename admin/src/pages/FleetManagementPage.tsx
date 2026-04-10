import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Car,
  Fuel,
  Gauge,
  MapPinned,
  Navigation,
  RefreshCw,
  Router,
  Settings2,
  Thermometer,
  Wrench,
} from 'lucide-react';
import api from '../lib/api';

type VehicleForm = {
  plateNumber: string;
  make: string;
  model: string;
  year: string;
  vin: string;
  fuelType: string;
  employeeId: string;
  obd2DeviceId: string;
  gpsTrackerId: string;
};

const INITIAL_FORM: VehicleForm = {
  plateNumber: '',
  make: '',
  model: '',
  year: '',
  vin: '',
  fuelType: 'PMS',
  employeeId: '',
  obd2DeviceId: '',
  gpsTrackerId: '',
};

export default function FleetManagementPage() {
  const [telemetryDash, setTelemetryDash] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [gpsLatest, setGpsLatest] = useState<any>(null);
  const [obd2Latest, setObd2Latest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [vehicleForm, setVehicleForm] = useState<VehicleForm>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  const [configVehicle, setConfigVehicle] = useState<any | null>(null);
  const [configSaving, setConfigSaving] = useState(false);

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      void loadAll(true);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [autoRefresh]);

  async function loadAll(silent = false) {
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);
    try {
      const [telemetryRes, vehiclesRes, gpsRes, obd2Res, employeesRes] = await Promise.allSettled([
        api.get('/telemetry/dashboard'),
        api.get('/telemetry/vehicles'),
        api.get('/telemetry/gps/latest/all'),
        api.get('/telemetry/obd2/latest/all'),
        api.get('/employees'),
      ]);

      if (telemetryRes.status === 'fulfilled') setTelemetryDash(telemetryRes.value.data.data);
      if (vehiclesRes.status === 'fulfilled') setVehicles(vehiclesRes.value.data.data || []);
      if (gpsRes.status === 'fulfilled') setGpsLatest(gpsRes.value.data);
      if (obd2Res.status === 'fulfilled') setObd2Latest(obd2Res.value.data);
      if (employeesRes.status === 'fulfilled') {
        const payload = employeesRes.value.data?.data;
        setEmployees(Array.isArray(payload) ? payload : payload?.employees || []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function addVehicle(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/telemetry/vehicles', {
        ...vehicleForm,
        year: vehicleForm.year ? parseInt(vehicleForm.year, 10) : undefined,
        employeeId: vehicleForm.employeeId || undefined,
        obd2DeviceId: vehicleForm.obd2DeviceId || undefined,
        gpsTrackerId: vehicleForm.gpsTrackerId || undefined,
      });
      setVehicleForm(INITIAL_FORM);
      setShowAddVehicle(false);
      await loadAll(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add vehicle');
    } finally {
      setSaving(false);
    }
  }

  async function saveVehicleConfiguration(e: FormEvent) {
    e.preventDefault();
    if (!configVehicle) return;
    setConfigSaving(true);
    try {
      await api.put(`/telemetry/vehicles/${configVehicle.id}`, {
        plateNumber: configVehicle.plateNumber,
        make: configVehicle.make,
        model: configVehicle.model,
        year: configVehicle.year || undefined,
        fuelType: configVehicle.fuelType,
        employeeId: configVehicle.employeeId || null,
        obd2DeviceId: configVehicle.obd2DeviceId || null,
        gpsTrackerId: configVehicle.gpsTrackerId || null,
        isActive: Boolean(configVehicle.isActive),
      });
      setConfigVehicle(null);
      await loadAll(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update configuration');
    } finally {
      setConfigSaving(false);
    }
  }

  const gpsData = Array.isArray(gpsLatest?.data) ? gpsLatest.data : [];
  const gpsSummary = gpsLatest?.summary || {};
  const obd2Data = Array.isArray(obd2Latest?.data) ? obd2Latest.data : [];
  const obd2Summary = obd2Latest?.summary || {};
  const obd2Alerts = Array.isArray(telemetryDash?.obd2?.alerts) ? telemetryDash.obd2.alerts : [];
  const vehicleList = Array.isArray(vehicles) ? vehicles : [];

  const coverage = useMemo(() => {
    const total = vehicleList.length || 1;
    const withGps = vehicleList.filter((v) => Boolean(v.gpsTrackerId)).length;
    const withObd2 = vehicleList.filter((v) => Boolean(v.obd2DeviceId)).length;
    return {
      gps: Math.round((withGps / total) * 100),
      obd2: Math.round((withObd2 / total) * 100),
      gpsMissing: vehicleList.filter((v) => !v.gpsTrackerId),
      obd2Missing: vehicleList.filter((v) => !v.obd2DeviceId),
    };
  }, [vehicleList]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-700 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Fleet Management Module</h1>
            <p className="mt-1 text-sm text-slate-200">Live GPS, OBD2 diagnostics, and production-ready device configuration.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAddVehicle((v) => !v)}
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
            >
              {showAddVehicle ? 'Close Form' : '+ Add Vehicle'}
            </button>
            <button
              onClick={() => void loadAll(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <label className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              Auto refresh 30s
            </label>
          </div>
        </div>
      </section>

      {showAddVehicle && (
        <form onSubmit={addVehicle} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-lg font-semibold">Register New Vehicle</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input required placeholder="Plate Number *" value={vehicleForm.plateNumber} onChange={(e) => setVehicleForm((f) => ({ ...f, plateNumber: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input placeholder="Make" value={vehicleForm.make} onChange={(e) => setVehicleForm((f) => ({ ...f, make: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input placeholder="Model" value={vehicleForm.model} onChange={(e) => setVehicleForm((f) => ({ ...f, model: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input type="number" placeholder="Year" value={vehicleForm.year} onChange={(e) => setVehicleForm((f) => ({ ...f, year: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input placeholder="VIN" value={vehicleForm.vin} onChange={(e) => setVehicleForm((f) => ({ ...f, vin: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <select value={vehicleForm.fuelType} onChange={(e) => setVehicleForm((f) => ({ ...f, fuelType: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="PMS">PMS (Petrol)</option>
              <option value="AGO">AGO (Diesel)</option>
              <option value="CNG">CNG</option>
            </select>
            <input placeholder="OBD2 Device ID" value={vehicleForm.obd2DeviceId} onChange={(e) => setVehicleForm((f) => ({ ...f, obd2DeviceId: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input placeholder="GPS Tracker ID" value={vehicleForm.gpsTrackerId} onChange={(e) => setVehicleForm((f) => ({ ...f, gpsTrackerId: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={saving} className="mt-3 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Register Vehicle'}
          </button>
        </form>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Vehicles" value={(telemetryDash?.fleet?.total || vehicleList.length).toString()} icon={Car} color="bg-indigo-500" />
        <StatCard label="GPS Coverage" value={`${coverage.gps}%`} icon={MapPinned} color="bg-emerald-500" />
        <StatCard label="OBD2 Coverage" value={`${coverage.obd2}%`} icon={Router} color="bg-cyan-500" />
        <StatCard label="Open Alerts" value={`${(obd2Summary.warning || 0) + (obd2Summary.check || 0)}`} icon={AlertTriangle} color="bg-rose-500" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900"><MapPinned className="mr-2 inline-block h-5 w-5 text-blue-500" />Live GPS Tracking</h2>
            <div className="flex gap-2 text-xs">
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">{gpsSummary.moving || 0} moving</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">{gpsSummary.idle || 0} idle</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{gpsSummary.parked || 0} parked</span>
            </div>
          </div>
          {loading ? (
            <div className="py-10 text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400" /></div>
          ) : gpsData.length === 0 ? (
            <TelemetrySetupCard
              title="GPS pipeline is online, waiting for first signal"
              steps={[
                'Assign GPS tracker IDs in Vehicle Registry configuration.',
                'Send positions to /api/telemetry/gps or /api/telemetry/gps/batch.',
                'Use ISO timestamps and valid coordinate ranges.',
              ]}
            />
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {gpsData.map((item: any) => (
                <div key={item.vehicleId} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{item.plateNumber}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.status === 'MOVING' ? 'bg-emerald-100 text-emerald-700' : item.status === 'IDLE' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                    }`}>{item.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.position.latitude.toFixed(5)}, {item.position.longitude.toFixed(5)} | {item.position.speed ? `${item.position.speed.toFixed(0)} km/h` : '0 km/h'} | {item.minutesAgo}m ago
                  </p>
                  <a
                    href={`https://maps.google.com/?q=${item.position.latitude},${item.position.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs font-medium text-indigo-600 hover:underline"
                  >
                    Open on map
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900"><Wrench className="mr-2 inline-block h-5 w-5 text-purple-500" />OBD2 Vehicle Health</h2>
            <div className="flex gap-2 text-xs">
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">{obd2Summary.healthy || 0} OK</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">{obd2Summary.warning || 0} warn</span>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">{obd2Summary.check || 0} check</span>
            </div>
          </div>
          {loading ? (
            <div className="py-10 text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400" /></div>
          ) : obd2Data.length === 0 ? (
            <TelemetrySetupCard
              title="OBD2 channel is ready for live diagnostics"
              steps={[
                'Pair each ELM327 adapter to a registered vehicle.',
                'Assign OBD2 device IDs under vehicle configuration.',
                'Submit readings through /api/telemetry/obd2 or /api/telemetry/obd2/batch.',
              ]}
            />
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {obd2Data.map((item: any) => (
                <div key={item.vehicleId} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{item.plateNumber}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.health === 'OK' ? 'bg-emerald-100 text-emerald-700' : item.health === 'WARNING' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>{item.health}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                    <OBD2Stat icon={Gauge} label="RPM" value={item.reading.rpm != null ? item.reading.rpm.toFixed(0) : '-'} />
                    <OBD2Stat icon={Navigation} label="Speed" value={item.reading.speed != null ? `${item.reading.speed}km/h` : '-'} />
                    <OBD2Stat icon={Fuel} label="Fuel" value={item.reading.fuelLevel != null ? `${item.reading.fuelLevel.toFixed(0)}%` : '-'} />
                    <OBD2Stat icon={Thermometer} label="Coolant" value={item.reading.engineCoolantTemp != null ? `${item.reading.engineCoolantTemp}C` : '-'} />
                  </div>
                  {item.reading.dtcCodes?.length > 0 && (
                    <p className="mt-2 text-xs text-amber-700">DTC: {item.reading.dtcCodes.join(', ')}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900"><Settings2 className="mr-2 inline-block h-5 w-5 text-indigo-500" />Fleet Configuration Center</h2>
          <Link to="/recharge" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Allocate Fuel</Link>
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p className="font-semibold">Vehicles missing GPS tracker: {coverage.gpsMissing.length}</p>
            <p className="mt-1 text-xs">Configure tracker IDs so vehicles appear in live movement monitoring.</p>
          </div>
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-sm text-purple-800">
            <p className="font-semibold">Vehicles missing OBD2 device: {coverage.obd2Missing.length}</p>
            <p className="mt-1 text-xs">Attach adapters to enable diagnostics, DTC alerts, and health scoring.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-3 py-2">Plate</th>
                <th className="px-3 py-2">Vehicle</th>
                <th className="px-3 py-2">Driver</th>
                <th className="px-3 py-2">GPS</th>
                <th className="px-3 py-2">OBD2</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {vehicleList.map((v: any) => (
                <tr key={v.id} className="border-b hover:bg-slate-50">
                  <td className="px-3 py-2 font-semibold">{v.plateNumber}</td>
                  <td className="px-3 py-2">{[v.make, v.model, v.year].filter(Boolean).join(' ') || '-'}</td>
                  <td className="px-3 py-2">{v.employee ? `${v.employee.firstName} ${v.employee.lastName}` : '-'}</td>
                  <td className="px-3 py-2">{v.gpsTrackerId ? <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">{v.gpsTrackerId}</span> : <span className="text-slate-400">Not configured</span>}</td>
                  <td className="px-3 py-2">{v.obd2DeviceId ? <span className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">{v.obd2DeviceId}</span> : <span className="text-slate-400">Not configured</span>}</td>
                  <td className="px-3 py-2">{v.isActive ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Active</span> : <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">Inactive</span>}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => setConfigVehicle({ ...v })} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
                      Configure
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && vehicleList.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">No vehicles registered yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {obd2Alerts.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-slate-900"><AlertTriangle className="mr-2 inline-block h-5 w-5 text-rose-500" />Recent OBD2 Alerts</h2>
          <div className="space-y-2">
            {obd2Alerts.slice(0, 10).map((a: any, i: number) => (
              <div key={`${a.vehicleId}-${i}`} className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm">
                <p className="font-semibold text-rose-900">{a.vehicle?.plateNumber || a.vehicleId}</p>
                <p className="text-xs text-rose-700">MIL: {a.milStatus ? 'ON' : 'OFF'} | DTC: {a.dtcCodes?.join(', ') || '-'}</p>
                <p className="text-xs text-rose-700">{new Date(a.recordedAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {configVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={saveVehicleConfiguration} className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Configure Vehicle: {configVehicle.plateNumber}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={configVehicle.plateNumber || ''} onChange={(e) => setConfigVehicle((v: any) => ({ ...v, plateNumber: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Plate Number" />
              <select value={configVehicle.employeeId || ''} onChange={(e) => setConfigVehicle((v: any) => ({ ...v, employeeId: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">No assigned driver</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.staffId})</option>
                ))}
              </select>
              <input value={configVehicle.gpsTrackerId || ''} onChange={(e) => setConfigVehicle((v: any) => ({ ...v, gpsTrackerId: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="GPS Tracker ID" />
              <input value={configVehicle.obd2DeviceId || ''} onChange={(e) => setConfigVehicle((v: any) => ({ ...v, obd2DeviceId: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="OBD2 Device ID" />
              <select value={configVehicle.fuelType || 'PMS'} onChange={(e) => setConfigVehicle((v: any) => ({ ...v, fuelType: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="PMS">PMS</option>
                <option value="AGO">AGO</option>
                <option value="CNG">CNG</option>
              </select>
              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <input type="checkbox" checked={Boolean(configVehicle.isActive)} onChange={(e) => setConfigVehicle((v: any) => ({ ...v, isActive: e.target.checked }))} />
                Active vehicle
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfigVehicle(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={configSaving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {configSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function TelemetrySetupCard({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <ul className="mt-2 space-y-1 text-xs text-slate-600">
        {steps.map((s) => (
          <li key={s}>- {s}</li>
        ))}
      </ul>
    </div>
  );
}

function OBD2Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="text-center">
      <Icon className="mx-auto h-3.5 w-3.5 text-slate-400" />
      <p className="font-semibold text-slate-900">{value}</p>
      <p className="text-slate-400">{label}</p>
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
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`flex h-12 w-12 items-center justify-center rounded-lg text-white ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
