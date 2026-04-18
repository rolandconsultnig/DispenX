import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

type SessionItem = {
  id: string;
  deviceId: string;
  deviceName: string;
  platform?: string | null;
  appVersion?: string | null;
  isTrusted: boolean;
  lastSeenAt?: string | null;
  createdAt: string;
};

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export default function ActiveSessionsScreen() {
  const { logout } = useAuth();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get('/mobile/auth/sessions');
      setSessions(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSessions();
  };

  const handleRevokeSession = (session: SessionItem) => {
    Alert.alert('Revoke session', `Sign out ${session.deviceName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          setRevokingId(session.id);
          try {
            await api.post(`/mobile/auth/sessions/${session.id}/revoke`);
            await fetchSessions();
          } finally {
            setRevokingId(null);
          }
        },
      },
    ]);
  };

  const handleLogoutAllDevices = () => {
    Alert.alert('Sign out everywhere', 'This will sign you out from all devices. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out All',
        style: 'destructive',
        onPress: async () => {
          setSigningOutAll(true);
          try {
            await logout(true);
          } finally {
            setSigningOutAll(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e40af']} />}
    >
      <View style={s.headerCard}>
        <Text style={s.headerTitle}>Active Sessions</Text>
        <Text style={s.headerSubtitle}>Signed-in devices for your account</Text>
        <TouchableOpacity style={s.dangerBtn} disabled={signingOutAll} onPress={handleLogoutAllDevices}>
          <Text style={s.dangerBtnText}>{signingOutAll ? 'Signing out…' : 'Sign Out All Devices'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={s.emptyText}>Loading sessions…</Text>
      ) : sessions.length === 0 ? (
        <Text style={s.emptyText}>No active sessions found.</Text>
      ) : (
        sessions.map((session) => (
          <View key={session.id} style={s.card}>
            <Text style={s.deviceName}>{session.deviceName}</Text>
            <Text style={s.meta}>Platform: {session.platform || 'Unknown'}</Text>
            <Text style={s.meta}>App Version: {session.appVersion || 'Unknown'}</Text>
            <Text style={s.meta}>Trusted: {session.isTrusted ? 'Yes' : 'No'}</Text>
            <Text style={s.meta}>Last Seen: {formatDate(session.lastSeenAt)}</Text>
            <Text style={s.metaSmall}>Device ID: {session.deviceId}</Text>
            <TouchableOpacity
              style={s.revokeBtn}
              disabled={revokingId === session.id}
              onPress={() => handleRevokeSession(session)}
            >
              <Text style={s.revokeBtnText}>{revokingId === session.id ? 'Revoking…' : 'Revoke Session'}</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  headerCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e3a5f' },
  headerSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 12 },
  dangerBtn: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dangerBtnText: { color: '#b91c1c', fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
  },
  deviceName: { fontSize: 15, fontWeight: '700', color: '#1e3a5f', marginBottom: 6 },
  meta: { fontSize: 13, color: '#334155', marginBottom: 2 },
  metaSmall: { marginTop: 6, fontSize: 11, color: '#64748b' },
  revokeBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  revokeBtnText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },
  emptyText: { textAlign: 'center', marginTop: 24, color: '#64748b' },
});
