import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import MobileDownloadPage from './pages/MobileDownloadPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import StationsPage from './pages/StationsPage';
import TransactionsPage from './pages/TransactionsPage';
import SettlementsPage from './pages/SettlementsPage';
import OrganizationsPage from './pages/OrganizationsPage';
import RechargePage from './pages/RechargePage';
import FleetManagementPage from './pages/FleetManagementPage';
import ReportingPage from './pages/ReportingPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" /></div>;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/download" element={<MobileDownloadPage />} />
      <Route
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/stations" element={<StationsPage />} />
        <Route path="/fleet-management" element={<FleetManagementPage />} />
        <Route path="/reporting" element={<ReportingPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/settlements" element={<SettlementsPage />} />
        <Route path="/organizations" element={<OrganizationsPage />} />
        <Route path="/recharge" element={<RechargePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
