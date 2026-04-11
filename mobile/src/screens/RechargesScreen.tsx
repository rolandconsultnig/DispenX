import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import api from '../lib/api';

interface Recharge {
  id: string;
  rechargeType: string;
  quotaType: string;
  amountNaira: number;
  amountLiters: number;
  balanceBefore: number;
  balanceAfter: number;
  notes?: string;
  createdAt: string;
}

export default function RechargesScreen() {
  const [recharges, setRecharges] = useState<Recharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const res = await api.get('/mobile/recharges');
      setRecharges(res.data.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const onRefresh = () => {
    setRefreshing(true);
    fetch();
  };

  const typeColor: Record<string, { bg: string; text: string }> = {
    TOP_UP: { bg: '#dbeafe', text: '#1e40af' },
    RESET: { bg: '#ffedd5', text: '#c2410c' },
    MONTHLY_ALLOCATION: { bg: '#dcfce7', text: '#166534' },
  };

  const renderItem = ({ item }: { item: Recharge }) => {
    const color = typeColor[item.rechargeType] || typeColor.TOP_UP;
    const amount = item.quotaType === 'NAIRA' ? `₦${item.amountNaira.toLocaleString()}` : `${item.amountLiters}L`;
    const after = item.quotaType === 'NAIRA' ? `₦${item.balanceAfter.toLocaleString()}` : `${item.balanceAfter}L`;

    return (
      <View style={styles.row}>
        <View style={styles.rowTop}>
          <View style={[styles.typeBadge, { backgroundColor: color.bg }]}>
            <Text style={[styles.typeText, { color: color.text }]}>{item.rechargeType.replace(/_/g, ' ')}</Text>
          </View>
          <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
        <View style={styles.rowBottom}>
          <View>
            <Text style={styles.amountLabel}>Amount</Text>
            <Text style={styles.amountValue}>+{amount}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amountLabel}>New Balance</Text>
            <Text style={styles.balanceValue}>{after}</Text>
          </View>
        </View>
        {item.notes && <Text style={styles.notes}>{item.notes}</Text>}
      </View>
    );
  };

  if (loading)
    return (
      <View style={styles.center}>
        <Text>Loading...</Text>
      </View>
    );

  return (
    <FlatList
      style={styles.container}
      data={recharges}
      keyExtractor={(r) => r.id}
      renderItem={renderItem}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e40af']} />}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.empty}>No recharges yet</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  empty: { color: '#94a3b8', fontSize: 15 },
  row: { backgroundColor: '#fff', padding: 16, marginHorizontal: 16, marginTop: 8, borderRadius: 12 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  typeText: { fontSize: 11, fontWeight: '700' },
  date: { fontSize: 12, color: '#94a3b8' },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  amountLabel: { fontSize: 11, color: '#94a3b8' },
  amountValue: { fontSize: 18, fontWeight: '700', color: '#22c55e', marginTop: 2 },
  balanceValue: { fontSize: 16, fontWeight: '700', color: '#1e3a5f', marginTop: 2 },
  notes: { fontSize: 12, color: '#64748b', marginTop: 8, fontStyle: 'italic' },
});
