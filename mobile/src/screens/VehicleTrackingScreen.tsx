import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, RefreshControl, ActivityIndicator, Switch,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import {
  startGpsTracking, stopGpsTracking, isGpsTracking,
  requestGpsPermission, getCurrentPosition,
} from '../lib/gpsService';

export default function VehicleTrackingScreen() {
  const { employee } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [tracking, setTracking] = useState(false);
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null);
  const [currentPos, setCurrentPos] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [vehicleRes, isTrack] = await Promise.all([
        api.get('/telemetry/vehicles').catch(() => ({ data: { data: [] } })),
        isGpsTracking(),
      ]);
      setVehicles(vehicleRes.data.data || []);
      setTracking(isTrack);

      // Get current position
      const pos = await getCurrentPosition();
      if (pos) {
        setCurrentPos({
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
          speed: pos.coords.speed ? (pos.coords.speed * 3.6).toFixed(1) : '0',
          accuracy: pos.coords.accuracy?.toFixed(0) || '—',
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleTracking = async (vehicleId: string) => {
    if (tracking) {
      await stopGpsTracking();
      setTracking(false);
      setActiveVehicleId(null);
    } else {
      const granted = await requestGpsPermission();
      if (!granted) {
        Alert.alert('Permission Required', 'GPS permission is needed for fleet tracking.');
        return;
      }
      const started = await startGpsTracking(vehicleId);
      if (started) {
        setTracking(true);
        setActiveVehicleId(vehicleId);
      } else {
        Alert.alert('Error', 'Failed to start GPS tracking.');
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
    >
      {/* GPS Status Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📍 GPS Status</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: tracking ? '#22c55e' : '#94a3b8' }]} />
          <Text style={styles.statusText}>{tracking ? 'Tracking Active' : 'Tracking Off'}</Text>
        </View>
        {currentPos && (
          <View style={styles.posGrid}>
            <PosItem label="Latitude" value={currentPos.lat} />
            <PosItem label="Longitude" value={currentPos.lng} />
            <PosItem label="Speed" value={`${currentPos.speed} km/h`} />
            <PosItem label="Accuracy" value={`±${currentPos.accuracy}m`} />
          </View>
        )}
      </View>

      {/* Vehicles */}
      <Text style={styles.sectionTitle}>My Vehicles</Text>
      {vehicles.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No vehicles assigned to your account.</Text>
          <Text style={styles.emptySubText}>Ask your fleet manager to assign a vehicle.</Text>
        </View>
      ) : (
        vehicles.map((v: any) => (
          <View key={v.id} style={styles.card}>
            <View style={styles.vehicleHeader}>
              <View>
                <Text style={styles.plateNumber}>{v.plateNumber}</Text>
                <Text style={styles.vehicleInfo}>
                  {[v.make, v.model, v.year].filter(Boolean).join(' ') || 'Vehicle'}
                </Text>
              </View>
              <View style={styles.trackToggle}>
                <Text style={styles.trackLabel}>{activeVehicleId === v.id && tracking ? 'ON' : 'OFF'}</Text>
                <Switch
                  value={activeVehicleId === v.id && tracking}
                  onValueChange={() => toggleTracking(v.id)}
                  trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                  thumbColor={activeVehicleId === v.id && tracking ? '#1e40af' : '#f4f3f4'}
                />
              </View>
            </View>

            <View style={styles.chipRow}>
              <Chip label={v.fuelType} color="#3b82f6" />
              {v.obd2DeviceId && <Chip label="OBD2" color="#8b5cf6" />}
              {v.gpsTrackerId && <Chip label="GPS Tracker" color="#059669" />}
              <Chip label={v.isActive ? 'Active' : 'Inactive'} color={v.isActive ? '#22c55e' : '#ef4444'} />
            </View>

            {v.employee && (
              <Text style={styles.assignedText}>
                Assigned to: {v.employee.firstName} {v.employee.lastName} ({v.employee.staffId})
              </Text>
            )}

            <View style={styles.statsRow}>
              <StatMini label="GPS Points" value={v._count?.gpsPositions || 0} />
              <StatMini label="OBD2 Reads" value={v._count?.obd2Readings || 0} />
            </View>
          </View>
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function PosItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.posItem}>
      <Text style={styles.posLabel}>{label}</Text>
      <Text style={styles.posValue}>{value}</Text>
    </View>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: color + '20' }]}>
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

function StatMini({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statMini}>
      <Text style={styles.statMiniValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statMiniLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  posGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  posItem: { width: '47%', backgroundColor: '#f8fafc', borderRadius: 8, padding: 8 },
  posLabel: { fontSize: 11, color: '#94a3b8' },
  posValue: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 8, marginTop: 8 },
  emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  emptySubText: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 4 },
  vehicleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  plateNumber: { fontSize: 18, fontWeight: '800', color: '#1e293b', letterSpacing: 1 },
  vehicleInfo: { fontSize: 13, color: '#64748b' },
  trackToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trackLabel: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { fontSize: 11, fontWeight: '600' },
  assignedText: { fontSize: 12, color: '#64748b', marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8 },
  statMini: { flex: 1, alignItems: 'center' },
  statMiniValue: { fontSize: 16, fontWeight: '700', color: '#1e40af' },
  statMiniLabel: { fontSize: 11, color: '#94a3b8' },
});
