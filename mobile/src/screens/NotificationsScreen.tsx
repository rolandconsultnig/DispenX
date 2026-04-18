import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import api from '../lib/api';
import { sendOrQueueMutation } from '../lib/offlineQueue';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const typeIcon: Record<string, string> = {
  RECHARGE: '🔋',
  TRANSACTION: '💳',
  DISPUTE: '⚠️',
  QUOTA: '📝',
  SYSTEM: '🔔',
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/mobile/notifications');
      setNotifications(res.data.data);
      setUnreadCount(res.data.meta?.unreadCount || 0);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const markAllRead = async () => {
    try {
      await sendOrQueueMutation({
        method: 'put',
        url: '/mobile/notifications/read-all',
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const isToday = new Date(item.createdAt).toDateString() === new Date().toDateString();
    return (
      <View style={[s.row, !item.read && s.unread]}>
        <View style={s.rowLeft}>
          <Text style={s.icon}>{typeIcon[item.type] || '🔔'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.message} numberOfLines={2}>
              {item.message}
            </Text>
            <Text style={s.date}>
              {isToday
                ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
          {!item.read && <View style={s.dot} />}
        </View>
      </View>
    );
  };

  if (loading)
    return (
      <View style={s.center}>
        <Text>Loading...</Text>
      </View>
    );

  return (
    <View style={s.container}>
      {unreadCount > 0 && (
        <TouchableOpacity style={s.markReadBtn} onPress={markAllRead}>
          <Text style={s.markReadText}>Mark all as read ({unreadCount})</Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            colors={['#1e40af']}
          />
        }
        ListEmptyComponent={
          <View style={s.center}>
            <Text style={s.empty}>No notifications yet</Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  empty: { color: '#94a3b8', fontSize: 15 },
  markReadBtn: { backgroundColor: '#dbeafe', padding: 10, margin: 16, marginBottom: 0, borderRadius: 10, alignItems: 'center' },
  markReadText: { color: '#1e40af', fontWeight: '600', fontSize: 13 },
  row: { backgroundColor: '#fff', padding: 16, marginHorizontal: 16, marginTop: 8, borderRadius: 12 },
  unread: { borderLeftWidth: 3, borderLeftColor: '#3b82f6' },
  rowLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  icon: { fontSize: 24 },
  title: { fontSize: 14, fontWeight: '700', color: '#1e3a5f' },
  message: { fontSize: 13, color: '#64748b', marginTop: 2, lineHeight: 18 },
  date: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6', marginTop: 4 },
});
