import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, ArrowRightLeft, BatteryCharging, AlertTriangle, UserCircle, LogOut, Fuel, Menu, X } from 'lucide-react';
import { useState } from 'react';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowRightLeft },
  { to: '/recharges', label: 'Recharges', icon: BatteryCharging },
  { to: '/disputes', label: 'Disputes', icon: AlertTriangle },
  { to: '/profile', label: 'Profile', icon: UserCircle },
];

export default function Layout() {
  const { employee, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-gray-900 transition-transform lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Fuel className="h-7 w-7 text-primary-400" />
            <span className="text-lg font-bold text-white">Staff Portal</span>
          </div>
          <button className="text-gray-400 lg:hidden" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="mt-4 space-y-1 px-3">
          {links.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} onClick={() => setOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
              <l.icon className="h-5 w-5" />{l.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-gray-800 p-4">
          <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white">
            <LogOut className="h-4 w-4" />Logout
          </button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b bg-white px-4 shadow-sm">
          <button className="lg:hidden" onClick={() => setOpen(true)}><Menu className="h-6 w-6 text-gray-600" /></button>
          <div />
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-800">{employee?.firstName} {employee?.lastName}</p>
              <p className="text-xs text-gray-500">{employee?.staffId}</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-sm font-bold text-primary-700">{employee?.firstName?.[0]}{employee?.lastName?.[0]}</span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
