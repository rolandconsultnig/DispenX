import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

interface Org {
  id: string;
  name: string;
}

export default function LoginScreen() {
  const { login, setupPin } = useAuth();
  const [mode, setMode] = useState<'login' | 'setup'>('login');
  const [staffId, setStaffId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [orgs, setOrgs] = useState<Org[]>([]);

  useEffect(() => {
    api
      .get('/mobile/organizations')
      .then((res) => {
        if (res.data.data) setOrgs(res.data.data);
      })
      .catch(() => {});
  }, []);

  const handleLogin = async () => {
    if (!staffId.trim() || !pin.trim()) return Alert.alert('Error', 'Please fill all fields');
    setLoading(true);
    try {
      await login(staffId.trim(), organizationId, pin);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      const message = msg || 'Login failed';
      if (message.includes('PIN not set')) {
        setMode('setup');
        Alert.alert('Setup Required', 'You need to set up your PIN first. Enter your phone number and choose a 4-6 digit PIN.');
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    if (!staffId.trim() || !phone.trim() || !pin.trim()) return Alert.alert('Error', 'Please fill all fields');
    if (pin.length < 4 || pin.length > 6) return Alert.alert('Error', 'PIN must be 4-6 digits');
    setLoading(true);
    try {
      await setupPin(staffId.trim(), organizationId, phone.trim(), pin);
      Alert.alert('Success', 'PIN set successfully. You are now logged in.');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Setup failed';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>⛽</Text>
        <Text style={styles.title}>CFMS Staff</Text>
        <Text style={styles.subtitle}>Corporate Fuel Management</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{mode === 'login' ? 'Login' : 'Setup PIN'}</Text>

        <Text style={styles.label}>Staff ID</Text>
        <TextInput
          style={styles.input}
          value={staffId}
          onChangeText={setStaffId}
          placeholder="e.g. EMP001"
          autoCapitalize="characters"
        />

        {orgs.length > 0 && (
          <>
            <Text style={styles.label}>Organization</Text>
            <View style={styles.orgList}>
              {orgs.map((org) => (
                <TouchableOpacity
                  key={org.id}
                  style={[styles.orgBtn, organizationId === org.id && styles.orgBtnActive]}
                  onPress={() => setOrganizationId(org.id)}
                >
                  <Text style={[styles.orgBtnText, organizationId === org.id && styles.orgBtnTextActive]}>{org.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {mode === 'setup' && (
          <>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+234..." keyboardType="phone-pad" />
          </>
        )}

        <Text style={styles.label}>PIN (4-6 digits)</Text>
        <TextInput
          style={styles.input}
          value={pin}
          onChangeText={setPin}
          placeholder="••••"
          secureTextEntry
          keyboardType="number-pad"
          maxLength={6}
        />

        <TouchableOpacity style={styles.button} onPress={mode === 'login' ? handleLogin : handleSetup} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{mode === 'login' ? 'Login' : 'Set PIN & Login'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'setup' : 'login')} style={styles.switchLink}>
          <Text style={styles.switchText}>{mode === 'login' ? 'First time? Set up PIN' : 'Already have PIN? Login'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#1e3a5f', justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: '#93c5fd', marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20, color: '#1e3a5f' },
  label: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: '#f8fafc' },
  button: { backgroundColor: '#1e40af', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switchLink: { marginTop: 16, alignItems: 'center' },
  switchText: { color: '#1e40af', fontSize: 13 },
  orgList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  orgBtn: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  orgBtnActive: { borderColor: '#1e40af', backgroundColor: '#eff6ff' },
  orgBtnText: { fontSize: 13, color: '#64748b' },
  orgBtnTextActive: { color: '#1e40af', fontWeight: '600' },
});
