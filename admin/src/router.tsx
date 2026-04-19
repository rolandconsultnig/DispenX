import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
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
import SiphoningAlertsPage from './pages/SiphoningAlertsPage';
import FinancePage from './pages/FinancePage';
import AccountingPage from './pages/AccountingPage';
import FraudManagementPage from './pages/FraudManagementPage';

function PrivateRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export const router = createBrowserRouter(
  [
    { path: '/login', element: <LoginPage /> },
    { path: '/download', element: <MobileDownloadPage /> },
    {
      path: '/',
      element: <PrivateRoute />,
      children: [
        {
          element: <Layout />,
          children: [
            { index: true, element: <DashboardPage /> },
            { path: 'employees', element: <EmployeesPage /> },
            { path: 'stations', element: <StationsPage /> },
            { path: 'fleet-management', element: <FleetManagementPage /> },
            { path: 'siphoning-alerts', element: <SiphoningAlertsPage /> },
            { path: 'fraud-management', element: <FraudManagementPage /> },
            { path: 'reporting', element: <ReportingPage /> },
            { path: 'transactions', element: <TransactionsPage /> },
            { path: 'settlements', element: <SettlementsPage /> },
            { path: 'organizations', element: <OrganizationsPage /> },
            { path: 'recharge', element: <RechargePage /> },
            { path: 'finance', element: <FinancePage /> },
            { path: 'accounting', element: <AccountingPage /> },
          ],
        },
      ],
    },
    { path: '*', element: <Navigate to="/" replace /> },
  ],
  {
    // Remix router futures (see @remix-run/router FutureConfig)
    future: {
      v7_relativeSplatPath: true,
    },
  }
);
