import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import api from '../lib/api';

interface Station {
  id: string;
  name: string;
  location?: string;
  address?: string;
  phone?: string;
  pricePms: number;
  priceAgo: number;
  priceCng: number;
}

export default function StationWhitelistScreen() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/mobile/whitelist/stations');
      setStations(res.data.data);
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

  const renderItem = ({ item }: { item: Station }) => (
    <View style={s.row}>
      <View style={s.rowHeader}>
        <Text style={s.icon}>⛽</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{item.name}</Text>
          {item.location && <Text style={s.location}>📍 {item.location}</Text>}
          {item.address && <Text style={s.address}>{item.address}</Text>}
        </View>
      </View>
      <View style={s.prices}>
        <View style={s.priceItem}>
          <Text style={s.priceLabel}>PMS</Text>
          <Text style={s.priceValue}>₦{item.pricePms}</Text>
        </View>
        <View style={s.priceItem}>
          <Text style={s.priceLabel}>AGO</Text>
          <Text style={s.priceValue}>₦{item.priceAgo}</Text>
        </View>
        <View style={s.priceItem}>
          <Text style={s.priceLabel}>CNG</Text>
          <Text style={s.priceValue}>₦{item.priceCng}</Text>
        </View>
      </View>
      {item.phone && <Text style={s.phone}>📞 {item.phone}</Text>}
    </View>
  );

  if (loading)
    return (
      <View style={s.center}>
        <Text>Loading...</Text>
      </View>
    );

  return (
    <FlatList
      style={s.container}
      data={stations}
      keyExtractor={(st) => st.id}
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
          <Text style={s.empty}>No stations available</Text>
        </View>
      }
      ListHeaderComponent={
        <View style={s.header}>
          <Text style={s.headerTitle}>Approved Stations</Text>
          <Text style={s.headerDesc}>You can refuel at any of these stations</Text>
        </View>
      }
    />
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  empty: { color: '#94a3b8', fontSize: 15 },
  header: { padding: 16, paddingBottom: 0 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1e3a5f' },
  headerDesc: { fontSize: 13, color: '#64748b', marginTop: 2 },
  row: { backgroundColor: '#fff', padding: 16, marginHorizontal: 16, marginTop: 10, borderRadius: 12 },
  rowHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  icon: { fontSize: 28 },
  name: { fontSize: 15, fontWeight: '700', color: '#1e3a5f' },
  location: { fontSize: 12, color: '#64748b', marginTop: 2 },
  address: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  prices: { flexDirection: 'row', gap: 8 },
  priceItem: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 8, padding: 10, alignItems: 'center' },
  priceLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '700' },
  priceValue: { fontSize: 14, fontWeight: '700', color: '#1e3a5f', marginTop: 2 },
  phone: { fontSize: 12, color: '#64748b', marginTop: 10 },
});
