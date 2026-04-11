/**
 * OBD2 Bluetooth Service for CFMS Mobile
 *
 * Connects to ELM327-compatible OBD2 Bluetooth adapters,
 * reads vehicle diagnostics PIDs, and reports to the server.
 *
 * Standard OBD2 PIDs (SAE J1979):
 *   01 0C = RPM
 *   01 0D = Vehicle Speed
 *   01 04 = Engine Load
 *   01 05 = Coolant Temperature
 *   01 0F = Intake Air Temperature
 *   01 2F = Fuel Level
 *   01 0A = Fuel Pressure
 *   01 11 = Throttle Position
 *   01 42 = Battery Voltage (Control Module)
 *   01 10 = MAF Air Flow Rate
 *   01 5E = Fuel Rate
 *   01 A6 = Odometer
 *   01 1F = Run Time since engine start
 *   03    = Request DTCs
 *   01 01 = MIL status + DTC count
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const OBD2_DEVICE_KEY = 'cfms_obd2_device';
const OBD2_BUFFER_KEY = 'cfms_obd2_buffer';

// ─── OBD2 PID Definitions ───────────────────────────────

export interface Obd2Data {
  rpm: number | null;
  speed: number | null;
  throttlePosition: number | null;
  engineLoad: number | null;
  engineCoolantTemp: number | null;
  intakeAirTemp: number | null;
  fuelLevel: number | null;
  fuelPressure: number | null;
  fuelRate: number | null;
  maf: number | null;
  dtcCodes: string[];
  milStatus: boolean;
  batteryVoltage: number | null;
  odometer: number | null;
  runTime: number | null;
}

export interface Obd2ConnectionInfo {
  deviceId: string;
  deviceName: string;
  connected: boolean;
  protocol: string;
}

// ELM327 AT commands
const ELM_INIT_COMMANDS = [
  'ATZ',     // Reset
  'ATE0',    // Echo off
  'ATL0',    // Linefeeds off
  'ATS0',    // Spaces off
  'ATH0',    // Headers off
  'ATSP0',   // Auto protocol detect
];

// PID definitions: [mode+pid, parser, fieldName]
const PID_DEFINITIONS: Array<{
  cmd: string;
  field: keyof Obd2Data;
  parse: (hex: string) => number | null;
}> = [
  {
    cmd: '010C', field: 'rpm',
    parse: (h) => { const v = parseInt(h.slice(4, 8), 16); return isNaN(v) ? null : v / 4; },
  },
  {
    cmd: '010D', field: 'speed',
    parse: (h) => { const v = parseInt(h.slice(4, 6), 16); return isNaN(v) ? null : v; },
  },
  {
    cmd: '0104', field: 'engineLoad',
    parse: (h) => { const v = parseInt(h.slice(4, 6), 16); return isNaN(v) ? null : (v * 100) / 255; },
  },
  {
    cmd: '0105', field: 'engineCoolantTemp',
    parse: (h) => { const v = parseInt(h.slice(4, 6), 16); return isNaN(v) ? null : v - 40; },
  },
  {
    cmd: '010F', field: 'intakeAirTemp',
    parse: (h) => { const v = parseInt(h.slice(4, 6), 16); return isNaN(v) ? null : v - 40; },
  },
  {
    cmd: '012F', field: 'fuelLevel',
    parse: (h) => { const v = parseInt(h.slice(4, 6), 16); return isNaN(v) ? null : (v * 100) / 255; },
  },
  {
    cmd: '010A', field: 'fuelPressure',
    parse: (h) => { const v = parseInt(h.slice(4, 6), 16); return isNaN(v) ? null : v * 3; },
  },
  {
    cmd: '0111', field: 'throttlePosition',
    parse: (h) => { const v = parseInt(h.slice(4, 6), 16); return isNaN(v) ? null : (v * 100) / 255; },
  },
  {
    cmd: '0110', field: 'maf',
    parse: (h) => { const v = parseInt(h.slice(4, 8), 16); return isNaN(v) ? null : v / 100; },
  },
  {
    cmd: '015E', field: 'fuelRate',
    parse: (h) => { const v = parseInt(h.slice(4, 8), 16); return isNaN(v) ? null : v / 20; },
  },
  {
    cmd: '0142', field: 'batteryVoltage',
    parse: (h) => { const v = parseInt(h.slice(4, 8), 16); return isNaN(v) ? null : v / 1000; },
  },
  {
    cmd: '011F', field: 'runTime',
    parse: (h) => { const v = parseInt(h.slice(4, 8), 16); return isNaN(v) ? null : v; },
  },
];

// ─── State ───────────────────────────────────────────────

let _connection: Obd2ConnectionInfo | null = null;
let _pollingTimer: ReturnType<typeof setInterval> | null = null;
let _vehicleId: string | null = null;

// Bluetooth transport abstraction — to be wired to react-native-ble-plx or
// react-native-bluetooth-classic at build time. This service provides the
// protocol layer; the actual transport is injected.
let _sendCommand: ((cmd: string) => Promise<string>) | null = null;

// ─── Transport injection ────────────────────────────────

/**
 * Register the low-level Bluetooth send function.
 * This allows swapping between BLE (react-native-ble-plx) and
 * Classic Bluetooth (react-native-bluetooth-classic) transports.
 */
export function registerTransport(sendFn: (cmd: string) => Promise<string>) {
  _sendCommand = sendFn;
}

// ─── ELM327 Communication ───────────────────────────────

async function sendElm(command: string): Promise<string> {
  if (!_sendCommand) throw new Error('No Bluetooth transport registered');
  const response = await _sendCommand(command);
  // clean ELM327 response: remove whitespace, >, \r, "SEARCHING..."
  return response
    .replace(/[\r\n\s>]/g, '')
    .replace(/SEARCHING\.\.\./g, '')
    .replace(/NODATA/g, '')
    .replace(/\?/g, '')
    .toUpperCase();
}

async function initElm(): Promise<boolean> {
  try {
    for (const cmd of ELM_INIT_COMMANDS) {
      await sendElm(cmd);
    }
    return true;
  } catch (e) {
    console.error('[OBD2] ELM init failed:', e);
    return false;
  }
}

// ─── PID Reading ─────────────────────────────────────────

async function readPid(pid: typeof PID_DEFINITIONS[number]): Promise<{ field: keyof Obd2Data; value: number | null }> {
  try {
    const raw = await sendElm(pid.cmd);
    if (!raw || raw.includes('NODATA') || raw.includes('ERROR')) {
      return { field: pid.field, value: null };
    }
    return { field: pid.field, value: pid.parse(raw) };
  } catch {
    return { field: pid.field, value: null };
  }
}

async function readDTCs(): Promise<string[]> {
  try {
    const raw = await sendElm('03');
    if (!raw || raw.includes('NODATA') || raw.length < 4) return [];

    // Parse DTC codes from mode 03 response
    // Format: 43 XX YY XX YY ... where each XXYY is a DTC
    const cleaned = raw.replace(/^43/, '');
    const codes: string[] = [];
    for (let i = 0; i < cleaned.length - 3; i += 4) {
      const dtcRaw = cleaned.slice(i, i + 4);
      if (dtcRaw === '0000') continue;

      const firstChar = parseInt(dtcRaw[0], 16);
      const prefix = ['P', 'C', 'B', 'U'][firstChar >> 2] || 'P';
      const digit1 = (firstChar & 0x03).toString();
      const rest = dtcRaw.slice(1);
      codes.push(`${prefix}${digit1}${rest}`);
    }
    return codes;
  } catch {
    return [];
  }
}

async function readMilStatus(): Promise<boolean> {
  try {
    const raw = await sendElm('0101');
    if (!raw || raw.length < 6) return false;
    const a = parseInt(raw.slice(4, 6), 16);
    return (a & 0x80) !== 0; // bit 7 of byte A = MIL on
  } catch {
    return false;
  }
}

// ─── Full Snapshot ───────────────────────────────────────

export async function readAllPids(): Promise<Obd2Data> {
  const data: Obd2Data = {
    rpm: null, speed: null, throttlePosition: null, engineLoad: null,
    engineCoolantTemp: null, intakeAirTemp: null, fuelLevel: null,
    fuelPressure: null, fuelRate: null, maf: null,
    dtcCodes: [], milStatus: false, batteryVoltage: null,
    odometer: null, runTime: null,
  };

  // Read all PIDs in sequence (OBD2 is single-request)
  for (const pid of PID_DEFINITIONS) {
    const result = await readPid(pid);
    if (result.value !== null) {
      (data as any)[result.field] = result.value;
    }
  }

  data.milStatus = await readMilStatus();
  data.dtcCodes = await readDTCs();

  return data;
}

// ─── Connection Management ──────────────────────────────

export async function connectObd2(
  deviceId: string,
  deviceName: string,
  vehicleId: string,
): Promise<boolean> {
  try {
    _vehicleId = vehicleId;

    const ok = await initElm();
    if (!ok) return false;

    _connection = {
      deviceId,
      deviceName,
      connected: true,
      protocol: 'ELM327',
    };

    await AsyncStorage.setItem(OBD2_DEVICE_KEY, JSON.stringify({ deviceId, deviceName, vehicleId }));
    console.log('[OBD2] Connected to', deviceName);
    return true;
  } catch (e) {
    console.error('[OBD2] Connect error:', e);
    return false;
  }
}

export function disconnectObd2(): void {
  stopPolling();
  _connection = null;
  _vehicleId = null;
  AsyncStorage.removeItem(OBD2_DEVICE_KEY);
  console.log('[OBD2] Disconnected');
}

export function getObd2Connection(): Obd2ConnectionInfo | null {
  return _connection;
}

// ─── Polling ─────────────────────────────────────────────

export function startPolling(intervalMs: number = 10000): void {
  if (_pollingTimer) return;

  _pollingTimer = setInterval(async () => {
    if (!_connection?.connected || !_vehicleId) return;

    try {
      const data = await readAllPids();
      await bufferReading(data);
      await flushObd2Buffer();
    } catch (e) {
      console.error('[OBD2] Poll error:', e);
    }
  }, intervalMs);

  console.log('[OBD2] Polling started, interval:', intervalMs);
}

export function stopPolling(): void {
  if (_pollingTimer) {
    clearInterval(_pollingTimer);
    _pollingTimer = null;
  }
}

// ─── Buffer & Upload ────────────────────────────────────

async function bufferReading(data: Obd2Data): Promise<void> {
  try {
    if (!_vehicleId) return;
    const existing = JSON.parse((await AsyncStorage.getItem(OBD2_BUFFER_KEY)) || '[]');
    existing.push({
      vehicleId: _vehicleId,
      ...data,
      recordedAt: new Date().toISOString(),
    });
    // Keep max 200 readings
    const trimmed = existing.slice(-200);
    await AsyncStorage.setItem(OBD2_BUFFER_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('[OBD2] Buffer error:', e);
  }
}

export async function flushObd2Buffer(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OBD2_BUFFER_KEY);
    if (!raw) return;
    const readings = JSON.parse(raw);
    if (readings.length === 0) return;

    await api.post('/telemetry/obd2/batch', { readings });
    await AsyncStorage.setItem(OBD2_BUFFER_KEY, '[]');
  } catch (e) {
    console.error('[OBD2] Flush error:', e);
  }
}

// Manual single-shot reading + report
export async function readAndReport(vehicleId: string): Promise<Obd2Data | null> {
  try {
    _vehicleId = vehicleId;
    const data = await readAllPids();

    await api.post('/telemetry/obd2', {
      vehicleId,
      ...data,
    });

    return data;
  } catch (e) {
    console.error('[OBD2] Read/report error:', e);
    return null;
  }
}
