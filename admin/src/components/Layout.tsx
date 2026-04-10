import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SidebarProvider, useSidebar } from '../context/SidebarContext';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';
import Backdrop from './Backdrop';

function LayoutContent() {
  const { user } = useAuth();
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-gray-50 xl:flex">
      <div>
        <AppSidebar />
        <Backdrop />
      </div>
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isExpanded || isHovered ? 'lg:ml-[290px]' : 'lg:ml-[90px]'
        } ${isMobileOpen ? 'ml-0' : ''}`}
      >
        <AppHeader />
        <main className="mx-auto max-w-[1540px] p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function Layout() {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
}
