/**
 * GPS Tracking Service for CFMS Mobile
 *
 * Uses expo-location for foreground/background GPS tracking.
 * Collects positions and batches them to the server.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const GPS_TASK_NAME = 'cfms-gps-tracking';
const GPS_BUFFER_KEY = 'cfms_gps_buffer';
const VEHICLE_ID_KEY = 'cfms_vehicle_id';

// ─── Background task definition ──────────────────────────
TaskManager.defineTask(GPS_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[GPS] Background task error:', error.message);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (locations && locations.length > 0) {
      await bufferPositions(locations);
      await flushBuffer();
    }
  }
});

// ─── Buffer management ───────────────────────────────────
async function bufferPositions(locations: Location.LocationObject[]) {
  try {
    const vehicleId = await AsyncStorage.getItem(VEHICLE_ID_KEY);
    if (!vehicleId) return;

    const existing = JSON.parse((await AsyncStorage.getItem(GPS_BUFFER_KEY)) || '[]');
    const newEntries = locations.map((loc) => ({
      vehicleId,
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      altitude: loc.coords.altitude,
      speed: loc.coords.speed ? loc.coords.speed * 3.6 : null, // m/s → km/h
      heading: loc.coords.heading,
      accuracy: loc.coords.accuracy,
      source: 'DEVICE',
      recordedAt: new Date(loc.timestamp).toISOString(),
    }));

    const merged = [...existing, ...newEntries].slice(-500); // keep max 500
    await AsyncStorage.setItem(GPS_BUFFER_KEY, JSON.stringify(merged));
  } catch (e) {
    console.error('[GPS] Buffer error:', e);
  }
}

async function flushBuffer() {
  try {
    const raw = await AsyncStorage.getItem(GPS_BUFFER_KEY);
    if (!raw) return;
    const positions = JSON.parse(raw);
    if (positions.length === 0) return;

    await api.post('/telemetry/gps/batch', { positions });
    await AsyncStorage.setItem(GPS_BUFFER_KEY, '[]');
  } catch (e) {
    // Will retry on next flush
    console.error('[GPS] Flush error:', e);
  }
}

// ─── Public API ──────────────────────────────────────────

export async function requestGpsPermission(): Promise<boolean> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return false;

  const background = await Location.requestBackgroundPermissionsAsync();
  return background.status === 'granted';
}

export async function startGpsTracking(vehicleId: string): Promise<boolean> {
  try {
    await AsyncStorage.setItem(VEHICLE_ID_KEY, vehicleId);

    const hasStarted = await Location.hasStartedLocationUpdatesAsync(GPS_TASK_NAME);
    if (hasStarted) {
      console.log('[GPS] Already tracking');
      return true;
    }

    await Location.startLocationUpdatesAsync(GPS_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 15000,       // every 15 seconds
      distanceInterval: 20,       // or every 20 meters
      foregroundService: {
        notificationTitle: 'CFMS Fleet Tracking',
        notificationBody: 'GPS location is being tracked',
        notificationColor: '#1e40af',
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });

    console.log('[GPS] Tracking started for vehicle:', vehicleId);
    return true;
  } catch (e) {
    console.error('[GPS] Start error:', e);
    return false;
  }
}

export async function stopGpsTracking(): Promise<void> {
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(GPS_TASK_NAME);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(GPS_TASK_NAME);
    }
    await flushBuffer(); // send remaining data
    await AsyncStorage.removeItem(VEHICLE_ID_KEY);
    console.log('[GPS] Tracking stopped');
  } catch (e) {
    console.error('[GPS] Stop error:', e);
  }
}

export async function isGpsTracking(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(GPS_TASK_NAME);
  } catch {
    return false;
  }
}

export async function getCurrentPosition(): Promise<Location.LocationObject | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    return await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  } catch {
    return null;
  }
}

// Manual single-shot GPS report
export async function reportPosition(vehicleId: string): Promise<boolean> {
  try {
    const loc = await getCurrentPosition();
    if (!loc) return false;

    await api.post('/telemetry/gps', {
      vehicleId,
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      altitude: loc.coords.altitude,
      speed: loc.coords.speed ? loc.coords.speed * 3.6 : null,
      heading: loc.coords.heading,
      accuracy: loc.coords.accuracy,
      source: 'DEVICE',
    });

    return true;
  } catch {
    return false;
  }
}

export { flushBuffer as flushGpsBuffer };
