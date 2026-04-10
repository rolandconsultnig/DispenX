import { Menu, PanelLeftClose } from 'lucide-react';
import { useSidebar } from '../context/SidebarContext';
import { useAuth } from '../context/AuthContext';

export default function AppHeader() {
  const { isExpanded, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const { employee } = useAuth();

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
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-900">{employee?.firstName} {employee?.lastName}</p>
          <p className="text-xs text-slate-500">{employee?.staffId}</p>
        </div>
      </div>
    </header>
  );
}
