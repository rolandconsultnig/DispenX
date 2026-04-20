import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import axios from 'axios';
import api, { getApiBaseUrl, hydrateApiBaseUrl } from '../lib/api';
import { parseApiBaseForForm, buildApiBaseUrl, saveStoredApiBase, getEnvApiBase } from '../lib/serverConfig';

function formatConnectionError(err: unknown, fullUrl: string): string {
  if (axios.isAxiosError(err)) {
    const code = err.code;
    const status = err.response?.status;
    const data = err.response?.data;
    const body =
      typeof data === 'object' && data !== null
        ? JSON.stringify(data).slice(0, 160)
        : typeof data === 'string'
          ? data.slice(0, 160)
          : '';
    if (code === 'ECONNABORTED') {
      return `Request timed out.\n\n${fullUrl}`;
    }
    if (err.message === 'Network Error' || code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
      return (
        `No TCP connection (wrong IP/port, offline, firewall, or HTTP blocked).\n` +
        `For plain HTTP to an IP, Android must allow cleartext (reinstall APK after update).\n\n` +
        `${fullUrl}\n` +
        (code ? `\n(${code})` : '')
      );
    }
    if (status != null) {
      return `HTTP ${status}${body ? ` — ${body}` : ''}\n\n${fullUrl}`;
    }
    return `${err.message}\n\n${fullUrl}`;
  }
  return `${String(err)}\n\n${fullUrl}`;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called after save or clear so callers can refetch profile or health. */
  onApplied?: () => void;
};

export default function ServerConfigModal({ visible, onClose, onApplied }: Props) {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('4601');
  const [secure, setSecure] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const parsed = parseApiBaseForForm(getApiBaseUrl() || getEnvApiBase());
    setHost(parsed.host);
    setPort(parsed.port && parsed.port !== '80' && parsed.port !== '443' ? parsed.port : '4601');
    setSecure(parsed.secure);
  }, [visible]);

  const applyBase = async (base: string | null) => {
    await saveStoredApiBase(base);
    await hydrateApiBaseUrl();
    onApplied?.();
  };

  const handleTest = async () => {
    let url: string;
    try {
      url = buildApiBaseUrl(host, port, secure);
    } catch (e) {
      Alert.alert('Invalid', e instanceof Error ? e.message : 'Check host and port');
      return;
    }
    setBusy(true);
    const prev = api.defaults.baseURL;
    api.defaults.baseURL = url;
    const healthPath = '/health';
    const fullUrl = `${url.replace(/\/$/, '')}${healthPath}`;
    try {
      await api.get(healthPath, { timeout: 12000 });
      Alert.alert('OK', 'Server responded (/api/health). You can save this address.');
    } catch (e) {
      Alert.alert('Failed', formatConnectionError(e, fullUrl));
    } finally {
      api.defaults.baseURL = prev;
      setBusy(false);
    }
  };

  const handleSave = async () => {
    let url: string;
    try {
      url = buildApiBaseUrl(host, port, secure);
    } catch (e) {
      Alert.alert('Invalid', e instanceof Error ? e.message : 'Check host and port');
      return;
    }
    setBusy(true);
    try {
      await applyBase(url);
      Alert.alert('Saved', 'API address updated.', [{ text: 'OK', onPress: onClose }]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const handleClear = () => {
    Alert.alert('Reset server URL?', 'The app will use the address from the build (EXPO_PUBLIC_API_BASE).', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await applyBase(null);
            const parsed = parseApiBaseForForm(getApiBaseUrl());
            setHost(parsed.host);
            setPort(parsed.port || '4601');
            setSecure(parsed.secure);
            Alert.alert('Reset', 'Build default is active again.', [{ text: 'OK', onPress: onClose }]);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Server connection</Text>
          <Text style={styles.hint}>
            Base URL ends with <Text style={styles.mono}>/api</Text> (e.g. <Text style={styles.mono}>http://YOUR_IP:4601/api</Text>). Test calls{' '}
            <Text style={styles.mono}>/api/health</Text>. If the API listens on another port (e.g. staff web 4603), only use it when that service proxies{' '}
            <Text style={styles.mono}>/api</Text> to the backend.
          </Text>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Host (IP or hostname)</Text>
            <TextInput
              style={styles.input}
              value={host}
              onChangeText={setHost}
              placeholder="e.g. 192.168.1.10"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="default"
            />

            <Text style={styles.label}>Port</Text>
            <TextInput
              style={styles.input}
              value={port}
              onChangeText={setPort}
              placeholder="4601"
              keyboardType="number-pad"
              maxLength={5}
            />

            <View style={styles.row}>
              <Text style={styles.label}>HTTPS</Text>
              <Switch value={secure} onValueChange={setSecure} />
            </View>

            <Text style={styles.current}>Current: {getApiBaseUrl() || getEnvApiBase()}</Text>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onClose} disabled={busy}>
              <Text style={styles.btnGhostText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={handleTest} disabled={busy}>
              {busy ? <ActivityIndicator /> : <Text style={styles.btnGhostText}>Test</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={handleSave} disabled={busy}>
              <Text style={styles.btnPrimaryText}>Save</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleClear} disabled={busy}>
            <Text style={styles.reset}>Use build default (clear override)</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 6 },
  hint: { fontSize: 13, color: '#64748b', marginBottom: 14 },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8fafc',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  current: { fontSize: 12, color: '#94a3b8', marginTop: 14 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 18, flexWrap: 'wrap' },
  btn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, minWidth: 72, alignItems: 'center' },
  btnGhost: { backgroundColor: '#f1f5f9' },
  btnGhostText: { color: '#334155', fontWeight: '700' },
  btnPrimary: { backgroundColor: '#1e40af', flexGrow: 1 },
  btnPrimaryText: { color: '#fff', fontWeight: '800' },
  reset: { textAlign: 'center', marginTop: 14, color: '#b91c1c', fontSize: 13, fontWeight: '600' },
});
