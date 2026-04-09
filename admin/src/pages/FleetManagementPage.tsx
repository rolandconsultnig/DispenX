import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Users, Fuel, Receipt, RefreshCw, MapPinned, Router,
  Car, Navigation, AlertTriangle, Gauge, Thermometer, Battery, Wrench,
} from 'lucide-react';
import api from '../lib/api';

export default function FleetManagementPage() {
  const [fleetOverview, setFleetOverview] = useState<any>(null);
  const [telemetryDash, setTelemetryDash] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [gpsLatest, setGpsLatest] = useState<any>(null);
  const [obd2Latest, setObd2Latest] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Vehicle form
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({
    plateNumber: '', make: '', model: '', year: '', vin: '',
    fuelType: 'PMS', employeeId: '', obd2DeviceId: '', gpsTrackerId: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [overviewRes, telemetryRes, vehiclesRes, gpsRes, obd2Res] = await Promise.allSettled([
        api.get('/fleet/overview'),
        api.get('/telemetry/dashboard'),
        api.get('/telemetry/vehicles'),
        api.get('/telemetry/gps/latest/all'),
        api.get('/telemetry/obd2/latest/all'),
      ]);

      if (overviewRes.status === 'fulfilled') setFleetOverview(overviewRes.value.data.data);
      if (telemetryRes.status === 'fulfilled') setTelemetryDash(telemetryRes.value.data.data);
      if (vehiclesRes.status === 'fulfilled') setVehicles(vehiclesRes.value.data.data || []);
      if (gpsRes.status === 'fulfilled') setGpsLatest(gpsRes.value.data);
      if (obd2Res.status === 'fulfilled') setObd2Latest(obd2Res.value.data);
    } finally {
      setLoading(false);
    }
  }

  async function addVehicle(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/telemetry/vehicles', {
        ...vehicleForm,
        year: vehicleForm.year ? parseInt(vehicleForm.year) : undefined,
        employeeId: vehicleForm.employeeId || undefined,
        obd2DeviceId: vehicleForm.obd2DeviceId || undefined,
        gpsTrackerId: vehicleForm.gpsTrackerId || undefined,
      });
      setShowAddVehicle(false);
      setVehicleForm({ plateNumber: '', make: '', model: '', year: '', vin: '', fuelType: 'PMS', employeeId: '', obd2DeviceId: '', gpsTrackerId: '' });
      loadAll();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add vehicle');
    } finally {
      setSaving(false);
    }
  }

  const gpsData = Array.isArray(gpsLatest?.data) ? gpsLatest.data : [];
  const gpsSummary = gpsLatest?.summary || {};
  const obd2Data = Array.isArray(obd2Latest?.data) ? obd2Latest.data : [];
  const obd2Summary = obd2Latest?.summary || {};
  const obd2Alerts = Array.isArray(telemetryDash?.obd2?.alerts) ? telemetryDash.obd2.alerts : [];
  const vehicleList = Array.isArray(vehicles) ? vehicles : [];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fleet Management</h1>
          <p className="text-sm text-gray-500">GPS tracking, OBD2 diagnostics, vehicle oversight and fleet analytics.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddVehicle(!showAddVehicle)}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50">
            {showAddVehicle ? 'Cancel' : '+ Add Vehicle'}
          </button>
          <Link to="/recharge" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
            Allocate Fuel
          </Link>
        </div>
      </div>

      {/* Add Vehicle Form */}
      {showAddVehicle && (
        <form onSubmit={addVehicle} className="mb-6 rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-lg font-semibold">Register New Vehicle</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input placeholder="Plate Number *" required value={vehicleForm.plateNumber}
              onChange={e => setVehicleForm(f => ({ ...f, plateNumber: e.target.value }))}
              className="rounded-lg border p-2 text-sm" />
            <input placeholder="Make (e.g. Toyota)" value={vehicleForm.make}
              onChange={e => setVehicleForm(f => ({ ...f, make: e.target.value }))}
              className="rounded-lg border p-2 text-sm" />
            <input placeholder="Model (e.g. Hilux)" value={vehicleForm.model}
              onChange={e => setVehicleForm(f => ({ ...f, model: e.target.value }))}
              className="rounded-lg border p-2 text-sm" />
            <input placeholder="Year" type="number" value={vehicleForm.year}
              onChange={e => setVehicleForm(f => ({ ...f, year: e.target.value }))}
              className="rounded-lg border p-2 text-sm" />
            <input placeholder="VIN" value={vehicleForm.vin}
              onChange={e => setVehicleForm(f => ({ ...f, vin: e.target.value }))}
              className="rounded-lg border p-2 text-sm" />
            <select value={vehicleForm.fuelType}
              onChange={e => setVehicleForm(f => ({ ...f, fuelType: e.target.value }))}
              className="rounded-lg border p-2 text-sm">
              <option value="PMS">PMS (Petrol)</option>
              <option value="AGO">AGO (Diesel)</option>
              <option value="CNG">CNG</option>
            </select>
            <input placeholder="OBD2 Device ID (Bluetooth)" value={vehicleForm.obd2DeviceId}
              onChange={e => setVehicleForm(f => ({ ...f, obd2DeviceId: e.target.value }))}
              className="rounded-lg border p-2 text-sm" />
            <input placeholder="GPS Tracker ID" value={vehicleForm.gpsTrackerId}
              onChange={e => setVehicleForm(f => ({ ...f, gpsTrackerId: e.target.value }))}
              className="rounded-lg border p-2 text-sm" />
          </div>
          <button type="submit" disabled={saving}
            className="mt-3 rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Register Vehicle'}
          </button>
        </form>
      )}

      {/* Top Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Vehicles" value={(telemetryDash?.fleet?.total || vehicles.length).toString()} icon={Car} color="bg-indigo-500" />
        <StatCard label="GPS Active" value={`${gpsSummary.moving || 0} moving`} icon={Navigation} color="bg-green-500" />
        <StatCard label="OBD2 Reporting" value={(obd2Summary.reporting || 0).toString()} icon={Gauge} color="bg-blue-500" />
        <StatCard label="Alerts" value={`${(obd2Summary.warning || 0) + (obd2Summary.check || 0)}`} icon={AlertTriangle} color="bg-red-500" />
      </div>

      {/* Fleet Telemetry Overview */}
      {telemetryDash && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">With OBD2</p>
            <p className="text-2xl font-bold">{telemetryDash.fleet?.withOBD2 || 0}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">With GPS</p>
            <p className="text-2xl font-bold">{telemetryDash.fleet?.withGPS || 0}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">GPS Pings (30m)</p>
            <p className="text-2xl font-bold">{telemetryDash.gps?.recentPositions || 0}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Avg Fuel Level</p>
            <p className="text-2xl font-bold">{telemetryDash.obd2?.avgFuelLevel != null ? `${telemetryDash.obd2.avgFuelLevel.toFixed(0)}%` : 'â€”'}</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* GPS Tracking Map (table view) */}
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              <MapPinned className="mr-2 inline-block h-5 w-5 text-blue-500" />
              Live GPS Tracking
            </h2>
            <div className="flex gap-2 text-xs">
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">{gpsSummary.moving || 0} moving</span>
              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-700">{gpsSummary.idle || 0} idle</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">{gpsSummary.parked || 0} parked</span>
            </div>
          </div>
          {loading ? (
            <div className="py-10 text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-400" /></div>
          ) : gpsData.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No GPS data yet. Vehicles will appear once they start reporting.</p>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {gpsData.map((item: any) => (
                <div key={item.vehicleId} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-gray-400" />
                      <span className="font-bold text-gray-900">{item.plateNumber}</span>
                      <span className="text-xs text-gray-500">{item.make} {item.model}</span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.status === 'MOVING' ? 'bg-green-100 text-green-700' :
                      item.status === 'IDLE' ? 'bg-yellow-100 text-yellow-700' :
                      item.status === 'PARKED' ? 'bg-gray-100 text-gray-500' :
                      'bg-red-100 text-red-700'
                    }`}>{item.status}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                    <span>ðŸ“ {item.position.latitude.toFixed(5)}, {item.position.longitude.toFixed(5)}</span>
                    <span>{item.position.speed ? `${item.position.speed.toFixed(0)} km/h` : '0 km/h'} â€¢ {item.minutesAgo}m ago</span>
                  </div>
                  {item.employee && (
                    <div className="mt-1 text-xs text-gray-400">
                      Driver: {item.employee.firstName} {item.employee.lastName} ({item.employee.staffId})
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* OBD2 Vehicle Health */}
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              <Wrench className="mr-2 inline-block h-5 w-5 text-purple-500" />
              OBD2 Vehicle Health
            </h2>
            <div className="flex gap-2 text-xs">
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">{obd2Summary.healthy || 0} OK</span>
              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-700">{obd2Summary.warning || 0} warn</span>
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">{obd2Summary.check || 0} check</span>
            </div>
          </div>
          {loading ? (
            <div className="py-10 text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-400" /></div>
          ) : obd2Data.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No OBD2 data yet. Connect ELM327 adapters to start monitoring.</p>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {obd2Data.map((item: any) => (
                <div key={item.vehicleId} className={`rounded-lg border p-3 ${
                  item.health === 'WARNING' ? 'border-red-200 bg-red-50' :
                  item.health === 'CHECK' ? 'border-yellow-200 bg-yellow-50' : ''
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-gray-400" />
                      <span className="font-bold text-gray-900">{item.plateNumber}</span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.health === 'OK' ? 'bg-green-100 text-green-700' :
                      item.health === 'WARNING' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{item.health}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                    <OBD2Stat icon={Gauge} label="RPM" value={item.reading.rpm != null ? item.reading.rpm.toFixed(0) : 'â€”'} />
                    <OBD2Stat icon={Navigation} label="Speed" value={item.reading.speed != null ? `${item.reading.speed}km/h` : 'â€”'} />
                    <OBD2Stat icon={Fuel} label="Fuel" value={item.reading.fuelLevel != null ? `${item.reading.fuelLevel.toFixed(0)}%` : 'â€”'} />
                    <OBD2Stat icon={Thermometer} label="Coolant" value={item.reading.engineCoolantTemp != null ? `${item.reading.engineCoolantTemp}Â°C` : 'â€”'} />
                  </div>
                  {item.reading.milStatus && (
                    <div className="mt-2 rounded border border-red-300 bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                      âš ï¸ Check Engine Light ON
                    </div>
                  )}
                  {item.reading.dtcCodes?.length > 0 && (
                    <div className="mt-1 text-xs font-mono text-amber-700">
                      DTCs: {item.reading.dtcCodes.join(', ')}
                    </div>
                  )}
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
                    <span>{item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : 'â€”'}</span>
                    <span>{item.minutesAgo}m ago</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* OBD2 Alerts */}
      {obd2Alerts.length > 0 && (
        <section className="mt-6 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            <AlertTriangle className="mr-2 inline-block h-5 w-5 text-red-500" />
            Recent OBD2 Alerts (24h)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
                  <th className="px-3 py-2">Vehicle</th>
                  <th className="px-3 py-2">MIL</th>
                  <th className="px-3 py-2">DTC Codes</th>
                  <th className="px-3 py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {obd2Alerts.map((alert: any, i: number) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{alert.vehicle?.plateNumber || alert.vehicleId.slice(0, 8)}</td>
                    <td className="px-3 py-2">
                      {alert.milStatus
                        ? <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">ON</span>
                        : <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">OFF</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{alert.dtcCodes?.join(', ') || 'â€”'}</td>
                    <td className="px-3 py-2 text-gray-500">{new Date(alert.recordedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Vehicle Registry */}
      <section className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          <Car className="mr-2 inline-block h-5 w-5 text-indigo-500" />
          Vehicle Registry ({vehicleList.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
                <th className="px-3 py-2">Plate</th>
                <th className="px-3 py-2">Vehicle</th>
                <th className="px-3 py-2">Fuel</th>
                <th className="px-3 py-2">Driver</th>
                <th className="px-3 py-2">OBD2</th>
                <th className="px-3 py-2">GPS</th>
                <th className="px-3 py-2">Data Points</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-10 text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-400" /></td></tr>
              ) : vehicleList.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-gray-400">No vehicles registered yet.</td></tr>
              ) : (
                vehicleList.map((v: any) => (
                  <tr key={v.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-bold">{v.plateNumber}</td>
                    <td className="px-3 py-2">{[v.make, v.model, v.year].filter(Boolean).join(' ') || 'â€”'}</td>
                    <td className="px-3 py-2"><span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{v.fuelType}</span></td>
                    <td className="px-3 py-2">{v.employee ? `${v.employee.firstName} ${v.employee.lastName}` : 'â€”'}</td>
                    <td className="px-3 py-2">
                      {v.obd2DeviceId
                        ? <span className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">{v.obd2DeviceId}</span>
                        : <span className="text-gray-400">â€”</span>}
                    </td>
                    <td className="px-3 py-2">
                      {v.gpsTrackerId
                        ? <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">{v.gpsTrackerId}</span>
                        : <span className="text-gray-400">â€”</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {v._count?.gpsPositions || 0} GPS â€¢ {v._count?.obd2Readings || 0} OBD2
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        v.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>{v.isActive ? 'Active' : 'Inactive'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Old Fleet Overview (Fuel allocation, org summary) */}
      {fleetOverview && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Employees" value={(fleetOverview.cards?.total || 0).toString()} icon={Users} color="bg-blue-500" />
          <StatCard label="Active Cards" value={(fleetOverview.cards?.active || 0).toString()} icon={Users} color="bg-green-500" />
          <StatCard label="Monthly (â‚¦)" value={`â‚¦${(fleetOverview.thisMonth?.naira || 0).toLocaleString()}`} icon={Receipt} color="bg-orange-500" />
          <StatCard label="Pending Quotas" value={(fleetOverview.pendingQuotaRequests || 0).toString()} icon={Building2} color="bg-purple-500" />
        </div>
      )}
    </div>
  );
}

function OBD2Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="text-center">
      <Icon className="mx-auto h-3.5 w-3.5 text-gray-400" />
      <p className="font-semibold text-gray-900">{value}</p>
      <p className="text-gray-400">{label}</p>
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
