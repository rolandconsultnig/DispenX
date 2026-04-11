import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

interface QuotaRequest {
  id: string;
  amountNaira: number;
  amountLiters: number;
  reason: string;
  status: string;
  reviewNote?: string;
  createdAt: string;
}

const statusColor: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: '#fef3c7', text: '#92400e' },
  APPROVED: { bg: '#dcfce7', text: '#166534' },
  REJECTED: { bg: '#fee2e2', text: '#991b1b' },
};

export default function RequestQuotaScreen() {
  const { employee } = useAuth();
  const [requests, setRequests] = useState<QuotaRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/mobile/quota-requests');
      setRequests(res.data.data);
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

  const isNaira = employee?.quotaType === 'NAIRA';

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return Alert.alert('Error', 'Enter a valid amount');
    if (reason.length < 5) return Alert.alert('Error', 'Reason must be at least 5 characters');

    setSubmitting(true);
    try {
      await api.post('/mobile/quota-requests', {
        ...(isNaira ? { amountNaira: amt } : { amountLiters: amt }),
        reason,
      });
      Alert.alert('Success', 'Quota request submitted for approval');
      setShowModal(false);
      setAmount('');
      setReason('');
      fetchData();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to submit request';
      Alert.alert('Error', msg || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: QuotaRequest }) => {
    const sc = statusColor[item.status] || statusColor.PENDING;
    const amt = isNaira ? `₦${item.amountNaira.toLocaleString()}` : `${item.amountLiters}L`;
    return (
      <View style={s.row}>
        <View style={s.rowTop}>
          <View style={[s.badge, { backgroundColor: sc.bg }]}>
            <Text style={[s.badgeText, { color: sc.text }]}>{item.status}</Text>
          </View>
          <Text style={s.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
        <Text style={s.amount}>Requested: {amt}</Text>
        <Text style={s.reason}>{item.reason}</Text>
        {item.reviewNote && <Text style={s.reviewNote}>Note: {item.reviewNote}</Text>}
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
      <FlatList
        data={requests}
        keyExtractor={(r) => r.id}
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
            <Text style={s.empty}>No quota requests yet</Text>
          </View>
        }
        ListHeaderComponent={
          <TouchableOpacity style={s.newBtn} onPress={() => setShowModal(true)}>
            <Text style={s.newBtnText}>+ Request Additional Quota</Text>
          </TouchableOpacity>
        }
      />

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Request Additional Quota</Text>

            <View style={s.currentBox}>
              <Text style={s.currentLabel}>Current Balance</Text>
              <Text style={s.currentValue}>
                {isNaira ? `₦${employee?.balanceNaira.toLocaleString()}` : `${employee?.balanceLiters}L`}
              </Text>
            </View>

            <Text style={s.label}>Amount ({isNaira ? '₦ Naira' : 'Liters'})</Text>
            <TextInput
              style={s.input}
              value={amount}
              onChangeText={setAmount}
              placeholder={isNaira ? 'e.g. 50000' : 'e.g. 100'}
              keyboardType="numeric"
            />

            <Text style={s.label}>Reason</Text>
            <TextInput
              style={[s.input, { height: 80 }]}
              value={reason}
              onChangeText={setReason}
              placeholder="Why do you need additional quota?"
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity style={s.submitBtn} onPress={submit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Submit Request</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowModal(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
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
  newBtn: { backgroundColor: '#1e40af', margin: 16, padding: 14, borderRadius: 12, alignItems: 'center' },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  row: { backgroundColor: '#fff', padding: 16, marginHorizontal: 16, marginTop: 8, borderRadius: 12 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  date: { fontSize: 12, color: '#94a3b8' },
  amount: { fontSize: 15, fontWeight: '700', color: '#1e3a5f' },
  reason: { fontSize: 13, color: '#64748b', marginTop: 4 },
  reviewNote: { fontSize: 12, color: '#166534', marginTop: 6, fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e3a5f', marginBottom: 16 },
  currentBox: { backgroundColor: '#f0f9ff', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 8 },
  currentLabel: { fontSize: 12, color: '#64748b' },
  currentValue: { fontSize: 22, fontWeight: '800', color: '#1e3a5f', marginTop: 4 },
  label: { fontSize: 12, fontWeight: '600', color: '#64748b', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14 },
  submitBtn: { backgroundColor: '#1e40af', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelBtn: { padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  cancelBtnText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
});
