import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import api from '../lib/api';
import {
  readAllPids, readAndReport, getObd2Connection, startPolling,
  stopPolling, Obd2Data,
} from '../lib/obd2Service';

export default function OBD2DiagnosticsScreen() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [liveData, setLiveData] = useState<Obd2Data | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadVehicles = useCallback(async () => {
    try {
      const res = await api.get('/telemetry/vehicles');
      setVehicles(res.data.data || []);
      if (res.data.data?.length > 0 && !selectedVehicle) {
        setSelectedVehicle(res.data.data[0].id);
      }
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedVehicle]);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  useEffect(() => {
    if (!selectedVehicle) return;
    api.get(`/telemetry/obd2/${selectedVehicle}?hours=24&limit=20`)
      .then(r => setHistory(r.data.data || []))
      .catch(() => {});
  }, [selectedVehicle]);

  const doRead = async () => {
    if (!selectedVehicle) return;
    setReading(true);
    try {
      const connection = getObd2Connection();
      if (!connection?.connected) {
        Alert.alert('OBD2 Not Connected', 'Connect to your OBD2 adapter via Bluetooth first.\n\nGo to your phone\'s Bluetooth settings, pair the ELM327 adapter, then return here.');
        return;
      }
      const data = await readAndReport(selectedVehicle);
      if (data) setLiveData(data);
    } catch (e) {
      Alert.alert('Error', 'Failed to read OBD2 data');
    } finally {
      setReading(false);
    }
  };

  const togglePolling = () => {
    if (polling) {
      stopPolling();
      setPolling(false);
    } else {
      startPolling(10000);
      setPolling(true);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1e40af" /></View>;
  }

  const selectedV = vehicles.find(v => v.id === selectedVehicle);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadVehicles(); }} />}
    >
      {/* Vehicle Selector */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔌 OBD2 Diagnostics</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {vehicles.map(v => (
            <TouchableOpacity
              key={v.id}
              onPress={() => setSelectedVehicle(v.id)}
              style={[styles.vehicleChip, selectedVehicle === v.id && styles.vehicleChipActive]}
            >
              <Text style={[styles.vehicleChipText, selectedVehicle === v.id && { color: '#fff' }]}>
                {v.plateNumber}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {selectedV && (
          <Text style={styles.subText}>
            {[selectedV.make, selectedV.model, selectedV.year].filter(Boolean).join(' ')}
            {selectedV.obd2DeviceId ? ` • OBD2: ${selectedV.obd2DeviceId}` : ' • No OBD2 device paired'}
          </Text>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.btnPrimary} onPress={doRead} disabled={reading}>
          <Text style={styles.btnText}>{reading ? 'Reading...' : '📊 Read Now'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnSecondary, polling && { backgroundColor: '#dc2626' }]}
          onPress={togglePolling}
        >
          <Text style={[styles.btnSecText, polling && { color: '#fff' }]}>
            {polling ? '⏹ Stop Poll' : '▶️ Auto Poll'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Live Data */}
      {liveData && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Live Readings</Text>
          <View style={styles.gaugeGrid}>
            <Gauge label="RPM" value={liveData.rpm} unit="" color="#ef4444" />
            <Gauge label="Speed" value={liveData.speed} unit="km/h" color="#3b82f6" />
            <Gauge label="Engine Load" value={liveData.engineLoad} unit="%" color="#f59e0b" />
            <Gauge label="Coolant" value={liveData.engineCoolantTemp} unit="°C" color="#06b6d4" />
            <Gauge label="Fuel Level" value={liveData.fuelLevel} unit="%" color="#22c55e" />
            <Gauge label="Throttle" value={liveData.throttlePosition} unit="%" color="#8b5cf6" />
            <Gauge label="Battery" value={liveData.batteryVoltage} unit="V" color="#f97316" />
            <Gauge label="Intake Air" value={liveData.intakeAirTemp} unit="°C" color="#14b8a6" />
            <Gauge label="MAF" value={liveData.maf} unit="g/s" color="#6366f1" />
            <Gauge label="Fuel Rate" value={liveData.fuelRate} unit="L/h" color="#ec4899" />
            <Gauge label="Fuel Press" value={liveData.fuelPressure} unit="kPa" color="#84cc16" />
            <Gauge label="Run Time" value={liveData.runTime ? Math.floor(liveData.runTime / 60) : null} unit="min" color="#64748b" />
          </View>

          {/* MIL / DTC */}
          {liveData.milStatus && (
            <View style={styles.milBanner}>
              <Text style={styles.milText}>⚠️ Check Engine Light ON</Text>
            </View>
          )}
          {liveData.dtcCodes.length > 0 && (
            <View style={styles.dtcBox}>
              <Text style={styles.dtcTitle}>Diagnostic Trouble Codes:</Text>
              {liveData.dtcCodes.map((code, i) => (
                <Text key={i} style={styles.dtcCode}>• {code}</Text>
              ))}
            </View>
          )}
          {liveData.odometer && (
            <Text style={styles.odometerText}>
              Odometer: {liveData.odometer.toLocaleString()} km
            </Text>
          )}
        </View>
      )}

      {/* Recent History */}
      <Text style={styles.sectionTitle}>Recent OBD2 History</Text>
      {history.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No OBD2 readings recorded yet.</Text>
        </View>
      ) : (
        history.slice(0, 10).map((r: any) => (
          <View key={r.id} style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTime}>
                {new Date(r.recordedAt).toLocaleString()}
              </Text>
              {r.milStatus && <Text style={styles.milBadge}>⚠️ MIL</Text>}
            </View>
            <View style={styles.historyStats}>
              {r.rpm != null && <MiniStat label="RPM" value={r.rpm.toFixed(0)} />}
              {r.speed != null && <MiniStat label="Speed" value={`${r.speed}km/h`} />}
              {r.fuelLevel != null && <MiniStat label="Fuel" value={`${r.fuelLevel.toFixed(0)}%`} />}
              {r.engineCoolantTemp != null && <MiniStat label="Temp" value={`${r.engineCoolantTemp}°C`} />}
              {r.batteryVoltage != null && <MiniStat label="Batt" value={`${r.batteryVoltage.toFixed(1)}V`} />}
            </View>
            {r.dtcCodes?.length > 0 && (
              <Text style={styles.historyDtc}>DTCs: {r.dtcCodes.join(', ')}</Text>
            )}
          </View>
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function Gauge({ label, value, unit, color }: { label: string; value: number | null; unit: string; color: string }) {
  return (
    <View style={styles.gauge}>
      <Text style={[styles.gaugeValue, { color }]}>
        {value != null ? (Number.isInteger(value) ? value : value.toFixed(1)) : '—'}
      </Text>
      <Text style={styles.gaugeUnit}>{unit}</Text>
      <Text style={styles.gaugeLabel}>{label}</Text>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
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
  subText: { fontSize: 12, color: '#64748b' },
  vehicleChip: {
    backgroundColor: '#e2e8f0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginRight: 8,
  },
  vehicleChipActive: { backgroundColor: '#1e40af' },
  vehicleChipText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  btnPrimary: {
    flex: 1, backgroundColor: '#1e40af', borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  btnSecondary: {
    flex: 1, backgroundColor: '#e2e8f0', borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnSecText: { color: '#475569', fontSize: 14, fontWeight: '700' },
  gaugeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gauge: {
    width: '30%', backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, alignItems: 'center',
  },
  gaugeValue: { fontSize: 18, fontWeight: '800' },
  gaugeUnit: { fontSize: 10, color: '#94a3b8' },
  gaugeLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },
  milBanner: {
    backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, marginTop: 12, borderWidth: 1, borderColor: '#fecaca',
  },
  milText: { fontSize: 14, fontWeight: '700', color: '#dc2626', textAlign: 'center' },
  dtcBox: { backgroundColor: '#fffbeb', borderRadius: 8, padding: 10, marginTop: 8 },
  dtcTitle: { fontSize: 13, fontWeight: '600', color: '#92400e', marginBottom: 4 },
  dtcCode: { fontSize: 13, color: '#78350f', fontFamily: 'monospace' },
  odometerText: { fontSize: 13, color: '#64748b', marginTop: 8, textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 8, marginTop: 8 },
  emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  historyCard: {
    backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1,
  },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  historyTime: { fontSize: 12, color: '#64748b' },
  milBadge: { fontSize: 11, color: '#dc2626', fontWeight: '600' },
  historyStats: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  miniStat: { alignItems: 'center', minWidth: 50 },
  miniStatValue: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  miniStatLabel: { fontSize: 10, color: '#94a3b8' },
  historyDtc: { fontSize: 11, color: '#92400e', marginTop: 4, fontFamily: 'monospace' },
});
