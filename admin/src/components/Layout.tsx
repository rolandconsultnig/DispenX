import { Navigate, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import { Menu, X, LogOut, User } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-gray-900 transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b bg-white px-4 shadow-sm">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="h-4 w-4" />
              <span>{user.firstName} {user.lastName}</span>
              <span className="rounded bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                {user.role.replace('_', ' ')}
              </span>
            </div>
            <button onClick={logout} className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50" title="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
