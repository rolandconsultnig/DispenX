import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Building2, Fuel, ArrowRightLeft, Receipt, BatteryCharging, X, Truck } from 'lucide-react';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/stations', label: 'Stations', icon: Fuel },
  { to: '/fleet-management', label: 'Fleet Management', icon: Truck },
  { to: '/transactions', label: 'Transactions', icon: ArrowRightLeft },
  { to: '/recharge', label: 'Recharge', icon: BatteryCharging },
  { to: '/settlements', label: 'Settlements', icon: Receipt },
  { to: '/organizations', label: 'Organizations', icon: Building2 },
];

export default function Sidebar({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-full flex-col border-r border-slate-800 bg-slate-950">
      <div className="flex h-20 items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20">
            <Fuel className="h-5 w-5 text-indigo-300" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-slate-100">EnergyDispenX</p>
            <p className="text-xs text-slate-400">Enterprise Console</p>
          </div>
        </div>
        <button className="text-slate-400 lg:hidden" onClick={onClose}>
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-3">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-900/30'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`
            }
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="rounded-xl bg-slate-900 p-3">
          <p className="text-xs font-medium text-slate-200">Corporate Fuel Management</p>
          <p className="mt-1 text-xs text-slate-400">TailAdmin-style navigation</p>
        </div>
      </div>
    </div>
  );
}
