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
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Fuel className="h-8 w-8 text-primary-400" />
          <span className="text-lg font-bold text-white">CFMS</span>
        </div>
        <button className="text-gray-400 lg:hidden" onClick={onClose}>
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="mt-4 flex-1 space-y-1 px-3">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <link.icon className="h-5 w-5" />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-gray-800 p-4">
        <p className="text-xs text-gray-500">Corporate Fuel Management</p>
        <p className="text-xs text-gray-600">v1.0.0</p>
      </div>
    </div>
  );
}
