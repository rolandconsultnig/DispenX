import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ArrowRightLeft, BatteryCharging, AlertTriangle, UserCircle, LogOut } from 'lucide-react';
import { useSidebar } from '../context/SidebarContext';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowRightLeft },
  { to: '/recharges', label: 'Recharges', icon: BatteryCharging },
  { to: '/disputes', label: 'Disputes', icon: AlertTriangle },
  { to: '/profile', label: 'Profile', icon: UserCircle },
];

export default function AppSidebar() {
  const { isExpanded, isHovered, isMobileOpen, setIsHovered } = useSidebar();
  const { logout } = useAuth();
  const expanded = isExpanded || isHovered || isMobileOpen;

  return (
    <aside
      className={`fixed left-0 top-0 z-50 h-screen border-r border-slate-200 bg-white transition-all duration-300 ${
        expanded ? 'w-[290px]' : 'w-[90px]'
      } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`flex h-20 items-center border-b border-slate-200 px-5 ${expanded ? 'justify-start' : 'justify-center'}`}>
        <img src="/energydispenx-logo.png" alt="EnergyDispenX logo" className="h-10 w-auto rounded-lg" />
        {expanded && (
          <div className="ml-3">
            <p className="text-sm font-semibold text-slate-900">EnergyDispenX</p>
            <p className="text-xs text-slate-500">Staff Workspace</p>
          </div>
        )}
      </div>
      <nav className="space-y-1 p-3">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              `group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-brand-50 text-brand-600' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              } ${expanded ? 'justify-start gap-3' : 'justify-center'}`
            }
          >
            <link.icon className="h-5 w-5" />
            {expanded && <span>{link.label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 p-3">
        <button
          onClick={logout}
          className={`flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 ${
            expanded ? 'justify-start gap-3' : 'justify-center'
          }`}
        >
          <LogOut className="h-5 w-5" />
          {expanded && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
