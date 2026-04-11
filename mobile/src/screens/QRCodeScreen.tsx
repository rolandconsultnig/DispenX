import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import api from '../lib/api';

const FUEL_TYPES = ['PMS', 'AGO', 'CNG'] as const;
const FUEL_LABELS: Record<string, string> = {
  PMS: '⛽ PMS (Petrol)',
  AGO: '🛢️ AGO (Diesel)',
  CNG: '💨 CNG (Gas)',
};

export default function QRCodeScreen() {
  const [amount, setAmount] = useState('');
  const [fuelType, setFuelType] = useState<string>('PMS');
  const [pin, setPin] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [purchaseInfo, setPurchaseInfo] = useState<{ amount: number; fuelType: string } | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch balance on mount
  useEffect(() => {
    api.get('/mobile/profile').then((res) => {
      const emp = res.data.data;
      setBalance(Number(emp.balanceNaira) || 0);
      if (emp.fuelType) setFuelType(emp.fuelType);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (expiresAt) {
      const update = () => {
        const diff = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
        setCountdown(diff);
        if (diff <= 0) {
          setQrData(null);
          setExpiresAt(null);
          setPurchaseInfo(null);
          if (timerRef.current) clearInterval(timerRef.current);
        }
      };
      update();
      timerRef.current = setInterval(update, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [expiresAt]);

  const handleBuyNow = async () => {
    const amountNum = parseFloat(amount);
    if (!amount.trim() || isNaN(amountNum) || amountNum <= 0) {
      return Alert.alert('Error', 'Enter a valid amount');
    }
    if (balance !== null && amountNum > balance) {
      return Alert.alert('Insufficient Balance', `Your balance is ₦${balance.toLocaleString()}. Enter a lower amount.`);
    }
    if (!pin.trim() || pin.length < 4) {
      return Alert.alert('Error', 'Enter your 4-6 digit PIN');
    }

    setLoading(true);
    try {
      const res = await api.post('/mobile/qr/generate', {
        pin,
        amountNaira: amountNum,
        fuelType,
      });
      const { qrPayload, expiresAt: exp, amountNaira: respAmount, fuelType: respFuel, employee } = res.data.data;
      setQrData(qrPayload);
      setExpiresAt(new Date(exp));
      setPurchaseInfo({ amount: respAmount, fuelType: respFuel });
      setBalance(Number(employee.balanceNaira) || 0);
      setPin('');
      setAmount('');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to generate QR';
      Alert.alert('Error', msg || 'Failed to generate QR');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (qrData && purchaseInfo) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.qrContainer}>
          <Text style={styles.heading}>Show this to the attendant</Text>

          <View style={styles.purchaseSummary}>
            <Text style={styles.summaryLabel}>Amount</Text>
            <Text style={styles.summaryValue}>₦{purchaseInfo.amount.toLocaleString()}</Text>
            <Text style={styles.summaryLabel}>Fuel Type</Text>
            <Text style={styles.summaryValue}>{FUEL_LABELS[purchaseInfo.fuelType] || purchaseInfo.fuelType}</Text>
          </View>

          <View style={styles.qrCard}>
            <QRCode value={qrData} size={220} />
          </View>

          <View style={[styles.timerBadge, countdown <= 60 ? styles.timerDanger : styles.timerOk]}>
            <Text style={styles.timerText}>Expires in {formatTime(countdown)}</Text>
          </View>

          <Text style={styles.hint}>
            The station attendant will scan this QR code to dispense {FUEL_LABELS[purchaseInfo.fuelType]?.split('(')[0] || 'fuel'} worth ₦{purchaseInfo.amount.toLocaleString()}.
          </Text>

          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => {
              setQrData(null);
              setExpiresAt(null);
              setPurchaseInfo(null);
            }}
          >
            <Text style={styles.newBtnText}>Buy More Fuel</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.formContainer}>
        <Text style={styles.icon}>⛽</Text>
        <Text style={styles.heading}>Buy Fuel</Text>
        <Text style={styles.desc}>
          Enter the amount, select fuel type and confirm with your PIN. A QR code will be generated for the attendant to scan.
        </Text>

        {balance !== null && (
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Text style={styles.balanceAmount}>₦{balance.toLocaleString()}</Text>
          </View>
        )}

        <Text style={styles.label}>Amount (₦)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="e.g. 5000"
          keyboardType="numeric"
          placeholderTextColor="#94a3b8"
        />

        <Text style={styles.label}>Fuel Type</Text>
        <View style={styles.fuelTypeRow}>
          {FUEL_TYPES.map((ft) => (
            <TouchableOpacity
              key={ft}
              style={[styles.fuelTypeBtn, fuelType === ft && styles.fuelTypeBtnActive]}
              onPress={() => setFuelType(ft)}
            >
              <Text style={[styles.fuelTypeBtnText, fuelType === ft && styles.fuelTypeBtnTextActive]}>
                {ft}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Enter PIN</Text>
        <TextInput
          style={styles.pinInput}
          value={pin}
          onChangeText={setPin}
          placeholder="••••"
          secureTextEntry
          keyboardType="number-pad"
          maxLength={6}
          placeholderTextColor="#94a3b8"
        />

        <TouchableOpacity style={styles.button} onPress={handleBuyNow} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Buy Now</Text>
          )}
        </TouchableOpacity>

        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>🔒 Security Note</Text>
          <Text style={styles.warningText}>
            • Each QR code can only be used once{'\n'}• Expires after 5 minutes{'\n'}• Never share your PIN with anyone
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  formContainer: { padding: 24, paddingBottom: 40 },
  qrContainer: { padding: 24, alignItems: 'center', paddingBottom: 40 },
  icon: { fontSize: 48, textAlign: 'center', marginBottom: 12 },
  heading: { fontSize: 22, fontWeight: '700', color: '#1e3a5f', textAlign: 'center', marginBottom: 8 },
  desc: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  balanceCard: {
    backgroundColor: '#1e40af',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 24,
  },
  balanceLabel: { color: '#bfdbfe', fontSize: 13, fontWeight: '500' },
  balanceAmount: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    backgroundColor: '#fff',
  },
  pinInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 20,
    backgroundColor: '#fff',
    textAlign: 'center',
    letterSpacing: 8,
  },
  fuelTypeRow: { flexDirection: 'row', gap: 10 },
  fuelTypeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  fuelTypeBtnActive: {
    borderColor: '#1e40af',
    backgroundColor: '#eff6ff',
  },
  fuelTypeBtnText: { fontSize: 15, fontWeight: '600', color: '#94a3b8' },
  fuelTypeBtnTextActive: { color: '#1e40af' },
  button: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  purchaseSummary: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignItems: 'center',
  },
  summaryLabel: { fontSize: 12, color: '#64748b', fontWeight: '500', marginTop: 4 },
  summaryValue: { fontSize: 20, fontWeight: '700', color: '#15803d' },
  qrCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    marginVertical: 20,
  },
  timerBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: 16 },
  timerOk: { backgroundColor: '#22c55e' },
  timerDanger: { backgroundColor: '#ef4444' },
  timerText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 13, color: '#64748b', textAlign: 'center', paddingHorizontal: 20, lineHeight: 18 },
  newBtn: { marginTop: 24, borderWidth: 1, borderColor: '#1e40af', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  newBtnText: { color: '#1e40af', fontWeight: '600' },
  warningBox: {
    marginTop: 24,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  warningTitle: { fontSize: 14, fontWeight: '700', color: '#92400e', marginBottom: 6 },
  warningText: { fontSize: 12, color: '#a16207', lineHeight: 18 },
});
