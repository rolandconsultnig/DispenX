import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { APP_DISPLAY_NAME, LOGO } from './src/constants/branding';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import QRCodeScreen from './src/screens/QRCodeScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import RechargesScreen from './src/screens/RechargesScreen';
import DisputesScreen from './src/screens/DisputesScreen';
import LostCardScreen from './src/screens/LostCardScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ActiveSessionsScreen from './src/screens/ActiveSessionsScreen';
import StationWhitelistScreen from './src/screens/StationWhitelistScreen';
import RequestQuotaScreen from './src/screens/RequestQuotaScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ChangePinScreen from './src/screens/ChangePinScreen';
import VehicleTrackingScreen from './src/screens/VehicleTrackingScreen';
import OBD2DiagnosticsScreen from './src/screens/OBD2DiagnosticsScreen';
import type { RootStackParamList } from './src/navigation/types';
import { hydrateApiBaseUrl } from './src/lib/api';

const Stack = createNativeStackNavigator<RootStackParamList>();

const headerStyle = {
  headerStyle: { backgroundColor: '#1e3a5f' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' as const },
};

function AppNavigator() {
  const { employee, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <Image source={LOGO} style={styles.loadingLogo} resizeMode="contain" accessibilityLabel={`${APP_DISPLAY_NAME} logo`} />
        <ActivityIndicator size="large" color="#1e40af" style={styles.loadingSpinner} />
        <Text style={styles.loadingBrand}>{APP_DISPLAY_NAME}</Text>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={headerStyle}>
      {employee ? (
        <>
          <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: APP_DISPLAY_NAME, headerShown: false }} />
          <Stack.Screen name="QRCode" component={QRCodeScreen} options={{ title: 'Generate QR Code' }} />
          <Stack.Screen name="Transactions" component={TransactionsScreen} options={{ title: 'Transaction History' }} />
          <Stack.Screen name="Recharges" component={RechargesScreen} options={{ title: 'Recharge History' }} />
          <Stack.Screen name="Disputes" component={DisputesScreen} options={{ title: 'Disputes' }} />
          <Stack.Screen name="LostCard" component={LostCardScreen} options={{ title: 'Lost / Stolen Card' }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
          <Stack.Screen name="ActiveSessions" component={ActiveSessionsScreen} options={{ title: 'Active Sessions' }} />
          <Stack.Screen name="StationWhitelist" component={StationWhitelistScreen} options={{ title: 'Approved Stations' }} />
          <Stack.Screen name="RequestQuota" component={RequestQuotaScreen} options={{ title: 'Request Quota' }} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
          <Stack.Screen name="ChangePin" component={ChangePinScreen} options={{ title: 'Change PIN' }} />
          <Stack.Screen name="VehicleTracking" component={VehicleTrackingScreen} options={{ title: 'Vehicle Tracking' }} />
          <Stack.Screen name="OBD2Diagnostics" component={OBD2DiagnosticsScreen} options={{ title: 'OBD2 Diagnostics' }} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  );
}

function ApiBaseReadyGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    hydrateApiBaseUrl().finally(() => setReady(true));
  }, []);
  if (!ready) {
    return (
      <View style={styles.loading}>
        <Image source={LOGO} style={styles.loadingLogo} resizeMode="contain" accessibilityLabel={`${APP_DISPLAY_NAME} logo`} />
        <ActivityIndicator size="large" color="#1e40af" style={styles.loadingSpinner} />
        <Text style={styles.loadingBrand}>{APP_DISPLAY_NAME}</Text>
        <Text style={styles.loadingText}>Starting…</Text>
      </View>
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ApiBaseReadyGate>
          <AuthProvider>
            <NavigationContainer>
              <StatusBar style="light" />
              <AppNavigator />
            </NavigationContainer>
          </AuthProvider>
        </ApiBaseReadyGate>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 24 },
  loadingLogo: { width: 180, height: 50, marginBottom: 8 },
  loadingSpinner: { marginTop: 8 },
  loadingBrand: { marginTop: 12, fontSize: 18, fontWeight: '800', color: '#1e3a5f' },
  loadingText: { marginTop: 6, color: '#64748b', fontSize: 14 },
});
