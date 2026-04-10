import { Menu, PanelLeftClose, User, LogOut } from 'lucide-react';
import { useSidebar } from '../context/SidebarContext';
import { useAuth } from '../context/AuthContext';

export default function AppHeader() {
  const { isExpanded, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (window.innerWidth >= 1024 ? toggleSidebar() : toggleMobileSidebar())}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
          >
            {window.innerWidth >= 1024 && isExpanded ? <PanelLeftClose className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <img src="/energydispenx-logo.png" alt="EnergyDispenX logo" className="h-8 w-auto rounded-md" />
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 sm:flex">
            <User className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">{user?.firstName} {user?.lastName}</span>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
              {user?.role?.replace('_', ' ')}
            </span>
          </div>
          <button onClick={logout} className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
