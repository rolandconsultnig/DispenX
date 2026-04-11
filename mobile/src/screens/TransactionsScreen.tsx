import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import api from '../lib/api';

interface Transaction {
  id: string;
  amountLiters: number;
  amountNaira: number;
  quotaType: string;
  source: string;
  fuelType: string;
  pumpPriceAtTime: number;
  transactedAt: string;
  station?: { id: string; name: string; location?: string };
}

type FilterSource = 'ALL' | 'RFID' | 'QR_CODE' | 'NFC';

export default function TransactionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterSource, setFilterSource] = useState<FilterSource>('ALL');
  const [selected, setSelected] = useState<Transaction | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/mobile/transactions', { params: { limit: 50 } });
      setTransactions(res.data.data);
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

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const filtered = filterSource === 'ALL' ? transactions : transactions.filter((t) => t.source === filterSource);
  const sourceIcon: Record<string, string> = { RFID: '💳', QR_CODE: '📱', NFC: '📲' };
  const filters: FilterSource[] = ['ALL', 'RFID', 'QR_CODE', 'NFC'];

  const renderItem = ({ item }: { item: Transaction }) => (
    <TouchableOpacity style={s.row} onPress={() => setSelected(item)}>
      <View style={s.rowLeft}>
        <Text style={s.sourceIcon}>{sourceIcon[item.source] || '💳'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.station}>{item.station?.name || 'Unknown Station'}</Text>
          <Text style={s.date}>
            {new Date(item.transactedAt).toLocaleDateString()} •{' '}
            {new Date(item.transactedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Text style={s.source}>
            {item.source.replace('_', ' ')} • {item.fuelType || 'PMS'} • {item.amountLiters.toFixed(1)}L
          </Text>
        </View>
      </View>
      <Text style={s.amount}>-₦{item.amountNaira.toLocaleString()}</Text>
    </TouchableOpacity>
  );

  if (loading)
    return (
      <View style={s.center}>
        <Text>Loading...</Text>
      </View>
    );

  return (
    <View style={s.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
        {filters.map((f) => (
          <TouchableOpacity key={f} style={[s.filterBtn, filterSource === f && s.filterActive]} onPress={() => setFilterSource(f)}>
            <Text style={[s.filterText, filterSource === f && s.filterTextActive]}>
              {f === 'ALL' ? 'All' : f === 'QR_CODE' ? 'QR Code' : f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e40af']} />}
        ListEmptyComponent={
          <View style={s.center}>
            <Text style={s.empty}>No transactions yet</Text>
          </View>
        }
      />

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            {selected && (
              <>
                <Text style={s.modalTitle}>Transaction Detail</Text>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Station</Text>
                  <Text style={s.detailValue}>{selected.station?.name}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Location</Text>
                  <Text style={s.detailValue}>{selected.station?.location || '-'}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Amount</Text>
                  <Text style={s.detailValue}>₦{selected.amountNaira.toLocaleString()}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Liters</Text>
                  <Text style={s.detailValue}>{selected.amountLiters.toFixed(2)}L</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Fuel Type</Text>
                  <Text style={s.detailValue}>{selected.fuelType || 'PMS'}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Pump Price</Text>
                  <Text style={s.detailValue}>₦{selected.pumpPriceAtTime}/L</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Source</Text>
                  <Text style={s.detailValue}>{selected.source.replace('_', ' ')}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Date</Text>
                  <Text style={s.detailValue}>{new Date(selected.transactedAt).toLocaleString()}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>ID</Text>
                  <Text style={[s.detailValue, { fontSize: 10 }]}>{selected.id}</Text>
                </View>

                <TouchableOpacity
                  style={s.disputeBtn}
                  onPress={() => {
                    const id = selected.id;
                    setSelected(null);
                    navigation.navigate('Disputes', { transactionId: id });
                  }}
                >
                  <Text style={s.disputeBtnText}>⚠️ Dispute Transaction</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.closeBtn} onPress={() => setSelected(null)}>
                  <Text style={s.closeBtnText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  empty: { color: '#94a3b8', fontSize: 15 },
  filterRow: { maxHeight: 50, paddingVertical: 8 },
  filterBtn: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  filterActive: { backgroundColor: '#1e40af', borderColor: '#1e40af' },
  filterText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  filterTextActive: { color: '#fff' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  sourceIcon: { fontSize: 24 },
  station: { fontSize: 14, fontWeight: '600', color: '#1e3a5f' },
  date: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  source: { fontSize: 11, color: '#64748b', marginTop: 1 },
  amount: { fontSize: 16, fontWeight: '700', color: '#dc2626' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e3a5f', marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  detailLabel: { fontSize: 13, color: '#64748b' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#1e3a5f' },
  disputeBtn: { backgroundColor: '#fef3c7', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  disputeBtnText: { color: '#92400e', fontWeight: '700', fontSize: 14 },
  closeBtn: { padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  closeBtnText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
});
