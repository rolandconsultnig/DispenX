import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import api from '../lib/api';

type Props = NativeStackScreenProps<RootStackParamList, 'ChangePin'>;

export default function ChangePinScreen({ navigation }: Props) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (currentPin.length < 4) return Alert.alert('Error', 'Enter your current PIN');
    if (newPin.length < 4) return Alert.alert('Error', 'New PIN must be at least 4 digits');
    if (newPin !== confirmPin) return Alert.alert('Error', 'PINs do not match');

    setLoading(true);
    try {
      await api.post('/mobile/change-pin', { currentPin, newPin });
      Alert.alert('Success', 'PIN changed successfully', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to change PIN';
      Alert.alert('Error', msg || 'Failed to change PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <View style={s.card}>
        <Text style={s.title}>Change PIN</Text>
        <Text style={s.desc}>Enter your current PIN and choose a new one.</Text>

        <Text style={s.label}>Current PIN</Text>
        <TextInput
          style={s.input}
          value={currentPin}
          onChangeText={setCurrentPin}
          placeholder="••••"
          secureTextEntry
          keyboardType="number-pad"
          maxLength={6}
        />

        <Text style={s.label}>New PIN</Text>
        <TextInput
          style={s.input}
          value={newPin}
          onChangeText={setNewPin}
          placeholder="••••"
          secureTextEntry
          keyboardType="number-pad"
          maxLength={6}
        />

        <Text style={s.label}>Confirm New PIN</Text>
        <TextInput
          style={s.input}
          value={confirmPin}
          onChangeText={setConfirmPin}
          placeholder="••••"
          secureTextEntry
          keyboardType="number-pad"
          maxLength={6}
        />

        <TouchableOpacity style={s.btn} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Change PIN</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  title: { fontSize: 20, fontWeight: '700', color: '#1e3a5f', marginBottom: 4 },
  desc: { fontSize: 13, color: '#64748b', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#64748b', marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    letterSpacing: 4,
  },
  btn: { backgroundColor: '#1e40af', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
