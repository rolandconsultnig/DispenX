import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, Platform, Image } from 'react-native';
import { APP_DISPLAY_NAME, APP_TAGLINE, LOGO } from '../constants/branding';
import { useAuth } from '../context/AuthContext';
import ServerConfigModal from '../components/ServerConfigModal';
import { SECRET_SERVER_UNLOCK_SEQUENCE } from '../lib/serverConfig';

export default function LoginScreen() {
  const { login, setupPin } = useAuth();
  const secretInputRef = useRef<TextInput>(null);
  const [secretBuffer, setSecretBuffer] = useState('');
  const [serverConfigOpen, setServerConfigOpen] = useState(false);
  const [mode, setMode] = useState<'login' | 'setup'>('login');
  const [staffId, setStaffId] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const onSecretDialChange = (t: string) => {
    setSecretBuffer(t);
    if (t.endsWith(SECRET_SERVER_UNLOCK_SEQUENCE)) {
      setSecretBuffer('');
      secretInputRef.current?.blur();
      setServerConfigOpen(true);
    }
  };

  const handleLogin = async () => {
    if (!staffId.trim() || !pin.trim()) return Alert.alert('Error', 'Please fill all fields');
    setLoading(true);
    try {
      await login(staffId.trim(), pin);
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
      await setupPin(staffId.trim(), phone.trim(), pin);
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
        <Image source={LOGO} style={styles.logoImg} resizeMode="contain" accessibilityLabel={`${APP_DISPLAY_NAME} logo`} />
        <Text style={styles.title}>{APP_DISPLAY_NAME}</Text>
        <Text style={styles.subtitle} onLongPress={() => secretInputRef.current?.focus()}>
          {APP_TAGLINE}
        </Text>
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

      <TextInput
        ref={secretInputRef}
        value={secretBuffer}
        onChangeText={onSecretDialChange}
        style={styles.secretCapture}
        autoCorrect={false}
        autoCapitalize="none"
        keyboardType="default"
        importantForAccessibility="no-hide-descendants"
      />

      <ServerConfigModal
        visible={serverConfigOpen}
        onClose={() => setServerConfigOpen(false)}
        onApplied={() => setSecretBuffer('')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#1e3a5f', justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  logoImg: { width: 200, height: 56, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: '#93c5fd', marginTop: 4 },
  secretCapture: {
    position: 'absolute',
    width: 48,
    height: 40,
    opacity: 0.02,
    bottom: 12,
    left: 12,
    ...(Platform.OS === 'android' ? { color: 'transparent' } : {}),
  },
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
});
