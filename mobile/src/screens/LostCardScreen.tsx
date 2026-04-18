import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { sendOrQueueMutation } from '../lib/offlineQueue';

export default function LostCardScreen() {
  const { employee, refreshProfile } = useAuth();
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(employee?.cardStatus === 'LOST');

  const reportLost = () => {
    Alert.alert(
      'Report Card Lost/Stolen',
      'This will immediately block your card. You will not be able to make any transactions until a replacement is issued.\n\nAre you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Block Card',
          style: 'destructive',
          onPress: async () => {
            setReporting(true);
            try {
              const result = await sendOrQueueMutation({
                method: 'post',
                url: '/mobile/card/report-lost',
              });
              if (!result.queued) {
                await refreshProfile();
              }
              setReported(true);
              Alert.alert(
                'Card Blocked',
                result.queued
                  ? 'No internet. Lost card report queued and will sync automatically.'
                  : 'Your card has been reported as lost and blocked immediately. Contact your administrator for a replacement.'
              );
            } catch (err: unknown) {
              const msg =
                err && typeof err === 'object' && 'response' in err
                  ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
                  : 'Failed to report card';
              Alert.alert('Error', msg || 'Failed to report card');
            } finally {
              setReporting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={s.container}>
      <View style={s.card}>
        {reported ? (
          <>
            <Text style={s.icon}>🔒</Text>
            <Text style={s.title}>Card Blocked</Text>
            <Text style={s.desc}>
              Your card has been reported as lost/stolen and is currently blocked. Contact your fleet manager or administrator to issue a
              replacement card.
            </Text>
            <View style={s.infoBox}>
              <Text style={s.infoTitle}>What happens next?</Text>
              <Text style={s.infoText}>• No transactions can be made with your card</Text>
              <Text style={s.infoText}>• Your balance is preserved</Text>
              <Text style={s.infoText}>• Admin will issue a replacement</Text>
              <Text style={s.infoText}>• You can still use QR codes if reactivated</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={s.icon}>⚠️</Text>
            <Text style={s.title}>Report Lost or Stolen Card</Text>
            <Text style={s.desc}>If your RFID/NFC card has been lost or stolen, report it immediately to prevent unauthorized use.</Text>

            <View style={s.infoBox}>
              <Text style={s.infoTitle}>What will happen:</Text>
              <Text style={s.infoText}>• Your card will be blocked immediately</Text>
              <Text style={s.infoText}>• No one can use it for transactions</Text>
              <Text style={s.infoText}>• Your balance remains safe</Text>
              <Text style={s.infoText}>• You'll need admin to reactivate/replace</Text>
            </View>

            <View style={s.cardInfo}>
              <Text style={s.cardLabel}>Current Card</Text>
              <Text style={s.cardValue}>{employee?.rfidUid || 'No RFID assigned'}</Text>
              <Text style={s.cardStatus}>Status: {employee?.cardStatus}</Text>
            </View>

            <TouchableOpacity style={s.reportBtn} onPress={reportLost} disabled={reporting}>
              {reporting ? <ActivityIndicator color="#fff" /> : <Text style={s.reportBtnText}>🚨 Report Card Lost / Stolen</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 16 },
  card: {
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
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#1e3a5f', marginBottom: 8, textAlign: 'center' },
  desc: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  infoBox: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, width: '100%', marginBottom: 16 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#1e3a5f', marginBottom: 8 },
  infoText: { fontSize: 13, color: '#64748b', lineHeight: 22 },
  cardInfo: { backgroundColor: '#f1f5f9', borderRadius: 12, padding: 16, width: '100%', marginBottom: 16, alignItems: 'center' },
  cardLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  cardValue: { fontSize: 16, fontWeight: '700', color: '#1e3a5f', marginTop: 4 },
  cardStatus: { fontSize: 12, color: '#22c55e', fontWeight: '600', marginTop: 4 },
  reportBtn: { backgroundColor: '#dc2626', padding: 16, borderRadius: 12, width: '100%', alignItems: 'center' },
  reportBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
