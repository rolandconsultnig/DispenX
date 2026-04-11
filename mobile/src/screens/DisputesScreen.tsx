import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import api from '../lib/api';

interface Dispute {
  id: string;
  transactionId?: string;
  issueType: string;
  description: string;
  status: string;
  resolution?: string;
  createdAt: string;
}

const ISSUE_TYPES = ['WRONG_AMOUNT', 'UNAUTHORIZED', 'STATION_ERROR', 'OTHER'] as const;
const statusColor: Record<string, { bg: string; text: string }> = {
  OPEN: { bg: '#dbeafe', text: '#1e40af' },
  UNDER_REVIEW: { bg: '#fef3c7', text: '#92400e' },
  RESOLVED: { bg: '#dcfce7', text: '#166534' },
  REJECTED: { bg: '#fee2e2', text: '#991b1b' },
};

type Props = NativeStackScreenProps<RootStackParamList, 'Disputes'>;

export default function DisputesScreen({ route }: Props) {
  const prefillTxId = route.params?.transactionId;
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(!!prefillTxId);
  const [issueType, setIssueType] = useState<string>('WRONG_AMOUNT');
  const [description, setDescription] = useState('');
  const [transactionId, setTransactionId] = useState(prefillTxId || '');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/mobile/disputes');
      setDisputes(res.data.data);
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

  const submit = async () => {
    if (description.length < 10) return Alert.alert('Error', 'Description must be at least 10 characters');
    setSubmitting(true);
    try {
      await api.post('/mobile/disputes', {
        issueType,
        description,
        ...(transactionId ? { transactionId } : {}),
      });
      Alert.alert('Success', 'Dispute submitted successfully');
      setShowModal(false);
      setDescription('');
      setTransactionId('');
      fetchData();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to submit dispute';
      Alert.alert('Error', msg || 'Failed to submit dispute');
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: Dispute }) => {
    const sc = statusColor[item.status] || statusColor.OPEN;
    return (
      <View style={s.row}>
        <View style={s.rowTop}>
          <View style={[s.badge, { backgroundColor: sc.bg }]}>
            <Text style={[s.badgeText, { color: sc.text }]}>{item.status.replace('_', ' ')}</Text>
          </View>
          <Text style={s.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
        <Text style={s.issueType}>{item.issueType.replace(/_/g, ' ')}</Text>
        <Text style={s.desc} numberOfLines={2}>
          {item.description}
        </Text>
        {item.resolution && <Text style={s.resolution}>Resolution: {item.resolution}</Text>}
        {item.transactionId && <Text style={s.txId}>TX: {item.transactionId.slice(0, 8)}...</Text>}
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
        data={disputes}
        keyExtractor={(d) => d.id}
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
            <Text style={s.empty}>No disputes yet</Text>
          </View>
        }
        ListHeaderComponent={
          <TouchableOpacity style={s.newBtn} onPress={() => setShowModal(true)}>
            <Text style={s.newBtnText}>+ New Dispute</Text>
          </TouchableOpacity>
        }
      />

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Submit Dispute</Text>

            <Text style={s.label}>Issue Type</Text>
            <View style={s.typeRow}>
              {ISSUE_TYPES.map((t) => (
                <TouchableOpacity key={t} style={[s.typeBtn, issueType === t && s.typeBtnActive]} onPress={() => setIssueType(t)}>
                  <Text style={[s.typeBtnText, issueType === t && s.typeBtnTextActive]}>{t.replace(/_/g, ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Transaction ID (optional)</Text>
            <TextInput style={s.input} value={transactionId} onChangeText={setTransactionId} placeholder="Paste transaction ID" />

            <Text style={s.label}>Description</Text>
            <TextInput
              style={[s.input, { height: 100 }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your issue in detail..."
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity style={s.submitBtn} onPress={submit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Submit Dispute</Text>}
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
  issueType: { fontSize: 14, fontWeight: '700', color: '#1e3a5f', marginBottom: 4 },
  desc: { fontSize: 13, color: '#64748b' },
  resolution: { fontSize: 12, color: '#166534', marginTop: 6, fontStyle: 'italic' },
  txId: { fontSize: 10, color: '#94a3b8', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e3a5f', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#64748b', marginTop: 12, marginBottom: 6 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  typeBtnActive: { backgroundColor: '#1e40af', borderColor: '#1e40af' },
  typeBtnText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  typeBtnTextActive: { color: '#fff' },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14 },
  submitBtn: { backgroundColor: '#1e40af', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelBtn: { padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  cancelBtnText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
});
