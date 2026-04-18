import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, ScrollView, Image } from 'react-native';
import { APP_DISPLAY_NAME, LOGO } from '../constants/branding';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getQueuedRequestCount } from '../lib/offlineQueue';

function FuelGauge({ percent, size = 160 }: { percent: number; size?: number }) {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const remaining = Math.max(0, Math.min(100, 100 - percent));
  const strokeDashoffset = circumference - (remaining / 100) * circumference;
  const color = remaining > 50 ? '#22c55e' : remaining > 20 ? '#f59e0b' : '#ef4444';

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#e2e8f0" strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color }}>{remaining.toFixed(0)}%</Text>
        <Text style={{ fontSize: 11, color: '#64748b' }}>remaining</Text>
      </View>
    </View>
  );
}

const FUEL_LABELS: Record<string, string> = { PMS: 'Petrol', AGO: 'Diesel', CNG: 'CNG' };

export default function DashboardScreen() {
  const { employee, refreshProfile, logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [refreshing, setRefreshing] = React.useState(false);
  const [pendingCount, setPendingCount] = React.useState(0);

  const refreshPendingCount = useCallback(async () => {
    const count = await getQueuedRequestCount();
    setPendingCount(count);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  }, [refreshProfile]);

  useEffect(() => {
    const interval = setInterval(refreshProfile, 30000);
    return () => clearInterval(interval);
  }, [refreshProfile]);

  useFocusEffect(
    useCallback(() => {
      refreshPendingCount();
    }, [refreshPendingCount])
  );

  if (!employee) return null;

  const isNaira = employee.quotaType === 'NAIRA';
  const balance = isNaira ? employee.balanceNaira : employee.balanceLiters;
  const quota = isNaira ? employee.quotaNaira : employee.quotaLiters;
  const balanceStr = isNaira ? `₦${balance.toLocaleString()}` : `${balance.toLocaleString()}L`;
  const quotaStr = isNaira ? `₦${quota.toLocaleString()}` : `${quota.toLocaleString()}L`;
  const usagePercent = quota > 0 ? Math.round(((quota - balance) / quota) * 100) : 0;
  const fuelLabel = FUEL_LABELS[employee.fuelType] || employee.fuelType;

  const actions: { icon: string; label: string; desc: string; screen: keyof RootStackParamList }[] = [
    { icon: '📱', label: 'QR Code', desc: 'Pay via QR', screen: 'QRCode' },
    { icon: '📋', label: 'Transactions', desc: 'View history', screen: 'Transactions' },
    { icon: '⛽', label: 'Stations', desc: 'Whitelisted', screen: 'StationWhitelist' },
    { icon: '🔋', label: 'Recharges', desc: 'Top-up logs', screen: 'Recharges' },
    { icon: '📝', label: 'Request Quota', desc: 'Ask for more', screen: 'RequestQuota' },
    { icon: '⚠️', label: 'Disputes', desc: 'Report issues', screen: 'Disputes' },
    { icon: '📍', label: 'GPS Tracking', desc: 'Vehicle GPS', screen: 'VehicleTracking' },
    { icon: '🔌', label: 'OBD2', desc: 'Diagnostics', screen: 'OBD2Diagnostics' },
    { icon: '🔔', label: 'Notifications', desc: 'Alerts', screen: 'Notifications' },
    { icon: '👤', label: 'Profile', desc: 'My account', screen: 'Profile' },
  ];

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e40af']} />}>
      <View style={s.header}>
        <View style={s.brandRow}>
          <Image source={LOGO} style={s.brandLogo} resizeMode="contain" accessibilityLabel={`${APP_DISPLAY_NAME} logo`} />
          <Text style={s.brandName}>{APP_DISPLAY_NAME}</Text>
        </View>
        <View style={s.headerTop}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {employee.firstName[0]}
              {employee.lastName[0]}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>
              {employee.firstName} {employee.lastName}
            </Text>
            <Text style={s.staffLabel}>
              {employee.staffId} • {employee.organization?.name || ''}
            </Text>
          </View>
          <View style={[s.statusBadge, employee.cardStatus === 'ACTIVE' ? s.active : s.blocked]}>
            <Text style={s.statusText}>{employee.cardStatus}</Text>
          </View>
        </View>
      </View>

      <View style={s.gaugeCard}>
        <FuelGauge percent={usagePercent} />
        <View style={s.gaugeInfo}>
          <Text style={s.gaugeBalance}>{balanceStr}</Text>
          <Text style={s.gaugeLabel}>
            of {quotaStr} • {fuelLabel}
          </Text>
        </View>
        <View style={s.fuelBadge}>
          <Text style={s.fuelBadgeText}>
            ⛽ {fuelLabel} ({employee.fuelType})
          </Text>
        </View>
      </View>

      <Text style={s.sectionTitle}>Quick Actions</Text>
      <View style={s.grid}>
        {actions.map((a) => (
          <TouchableOpacity key={a.screen} style={s.actionBtn} onPress={() => navigation.navigate(a.screen)}>
            <Text style={s.actionIcon}>{a.icon}</Text>
            <Text style={s.actionLabel}>{a.label}</Text>
            <Text style={s.actionDesc}>{a.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.infoRow}>
        <View style={s.infoItem}>
          <Text style={s.infoLabel}>RFID</Text>
          <Text style={s.infoValue}>{employee.rfidUid || 'Not assigned'}</Text>
        </View>
        <View style={s.infoItem}>
          <Text style={s.infoLabel}>Quota Type</Text>
          <Text style={s.infoValue}>{employee.quotaType}</Text>
        </View>
      </View>

      {pendingCount > 0 && (
        <View style={s.pendingBox}>
          <Text style={s.pendingText}>⏳ Pending offline actions: {pendingCount}</Text>
        </View>
      )}

      <TouchableOpacity style={s.logoutBtn} onPress={() => logout()}>
        <Text style={s.logoutText}>🚪 Sign Out</Text>
      </TouchableOpacity>
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { backgroundColor: '#1e3a5f', paddingTop: 48, paddingBottom: 20, paddingHorizontal: 16 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.2)' },
  brandLogo: { width: 36, height: 36, borderRadius: 8 },
  brandName: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  name: { fontSize: 18, fontWeight: '700', color: '#fff' },
  staffLabel: { fontSize: 12, color: '#93c5fd', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  active: { backgroundColor: '#22c55e' },
  blocked: { backgroundColor: '#ef4444' },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  gaugeCard: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  gaugeInfo: { marginTop: 12, alignItems: 'center' },
  gaugeBalance: { fontSize: 32, fontWeight: '800', color: '#1e3a5f' },
  gaugeLabel: { fontSize: 13, color: '#64748b', marginTop: 2 },
  fuelBadge: { marginTop: 12, backgroundColor: '#dbeafe', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 10 },
  fuelBadgeText: { color: '#1e40af', fontSize: 12, fontWeight: '700' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1e3a5f', marginHorizontal: 16, marginTop: 8, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  actionBtn: {
    width: '23%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: { fontSize: 24, marginBottom: 4 },
  actionLabel: { fontSize: 11, fontWeight: '700', color: '#1e3a5f', textAlign: 'center' },
  actionDesc: { fontSize: 9, color: '#94a3b8', marginTop: 1, textAlign: 'center' },
  infoRow: { flexDirection: 'row', margin: 16, gap: 12 },
  infoItem: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  infoLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  infoValue: { fontSize: 14, color: '#1e3a5f', fontWeight: '600', marginTop: 4 },
  pendingBox: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fef9c3', borderRadius: 10, padding: 10 },
  pendingText: { color: '#854d0e', fontWeight: '700', fontSize: 12, textAlign: 'center' },
  logoutBtn: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutText: { color: '#dc2626', fontSize: 14, fontWeight: '700' },
});
