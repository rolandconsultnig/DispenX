import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import ServerConfigModal from '../components/ServerConfigModal';
import { SECRET_SERVER_UNLOCK_SEQUENCE } from '../lib/serverConfig';

const FUEL_LABELS: Record<string, string> = {
  PMS: 'Petrol (PMS)',
  AGO: 'Diesel (AGO)',
  CNG: 'Compressed Natural Gas (CNG)',
};

export default function ProfileScreen() {
  const { employee, logout, refreshProfile } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const secretInputRef = useRef<TextInput>(null);
  const [secretBuffer, setSecretBuffer] = useState('');
  const [serverConfigOpen, setServerConfigOpen] = useState(false);

  const onSecretDialChange = (t: string) => {
    setSecretBuffer(t);
    if (t.endsWith(SECRET_SERVER_UNLOCK_SEQUENCE)) {
      setSecretBuffer('');
      secretInputRef.current?.blur();
      setServerConfigOpen(true);
    }
  };

  if (!employee) return null;

  const isNaira = employee.quotaType === 'NAIRA';
  const balance = isNaira ? `₦${employee.balanceNaira.toLocaleString()}` : `${employee.balanceLiters}L`;
  const quota = isNaira ? `₦${employee.quotaNaira.toLocaleString()}` : `${employee.quotaLiters}L`;

  const rows = [
    { label: 'Staff ID', value: employee.staffId },
    { label: 'Name', value: `${employee.firstName} ${employee.lastName}` },
    { label: 'Phone', value: employee.phone || 'N/A' },
    { label: 'Email', value: employee.email || 'N/A' },
    { label: 'Organization', value: employee.organization?.name || 'N/A' },
    { label: 'RFID Card', value: employee.rfidUid || 'Not assigned' },
    { label: 'Card Status', value: employee.cardStatus },
    { label: 'Fuel Type', value: FUEL_LABELS[employee.fuelType] || employee.fuelType },
    { label: 'Allotment category', value: employee.allotmentCategory || 'N/A' },
    { label: 'Quota Type', value: employee.quotaType },
    { label: 'Total Quota', value: quota },
    { label: 'Balance', value: balance },
  ];

  return (
    <ScrollView style={s.container}>
      <View style={s.avatarSection}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>
            {employee.firstName[0]}
            {employee.lastName[0]}
          </Text>
        </View>
        <Text style={s.name}>
          {employee.firstName} {employee.lastName}
        </Text>
        <Text style={s.sub} onLongPress={() => secretInputRef.current?.focus()}>
          {employee.staffId}
        </Text>
      </View>

      <View style={s.card}>
        {rows.map((r, i) => (
          <View key={r.label} style={[s.row, i < rows.length - 1 && s.rowBorder]}>
            <Text style={s.label}>{r.label}</Text>
            <Text style={s.value}>{r.value}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate('LostCard')}>
        <Text style={s.actionText}>🚨 Report Lost Card</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate('ChangePin')}>
        <Text style={s.actionText}>🔑 Change PIN</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate('ActiveSessions')}>
        <Text style={s.actionText}>📱 Active Sessions</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.logoutBtn} onPress={() => logout()}>
        <Text style={s.logoutText}>🚪 Sign Out</Text>
      </TouchableOpacity>

      <TextInput
        ref={secretInputRef}
        value={secretBuffer}
        onChangeText={onSecretDialChange}
        style={s.secretCapture}
        autoCorrect={false}
        autoCapitalize="none"
        keyboardType="default"
        importantForAccessibility="no-hide-descendants"
      />

      <ServerConfigModal
        visible={serverConfigOpen}
        onClose={() => setServerConfigOpen(false)}
        onApplied={() => {
          refreshProfile();
        }}
      />

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  name: { fontSize: 20, fontWeight: '700', color: '#1e3a5f' },
  sub: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  secretCapture: {
    position: 'absolute',
    width: 48,
    height: 40,
    opacity: 0.02,
    bottom: 8,
    left: 8,
    ...(Platform.OS === 'android' ? { color: 'transparent' } : {}),
  },
  card: { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, padding: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  label: { fontSize: 13, color: '#64748b' },
  value: { fontSize: 13, fontWeight: '600', color: '#1e3a5f', maxWidth: '55%', textAlign: 'right' },
  actionBtn: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 12, alignItems: 'center' },
  actionText: { fontSize: 14, fontWeight: '600', color: '#1e3a5f' },
  logoutBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutText: { color: '#dc2626', fontSize: 14, fontWeight: '700' },
});
