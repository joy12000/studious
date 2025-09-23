import React, { useState, createContext, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, Settings, X, List, Menu, Calendar, GraduationCap, LayoutDashboard, BrainCircuit, ChevronsLeft, ChevronsRight } from 'lucide-react';

// 사이드바 상태 공유를 위한 Context
interface SidebarContextType {
  isSidebarOpen: boolean;
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}
export const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

const NavLink = ({ to, icon, children, isCollapsed }: { to: string, icon: React.ReactNode, children: React.ReactNode, isCollapsed: boolean }) => {
    const location = useLocation();
    const isActive = location.pathname === to;
    return (
      <Button asChild variant={isActive ? "secondary" : "ghost"} className="w-full justify-start">
        <Link to={to} title={isCollapsed ? String(children) : undefined}>
          {icon}
          {!isCollapsed && <span className="ml-3 truncate">{children}</span>}
        </Link>
      </Button>
    );
};

const SidebarContent = ({ isCollapsed, onToggleCollapse }: { isCollapsed: boolean, onToggleCollapse: () => void }) => {
    const { setIsSidebarOpen } = useSidebar();
    return (
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <GraduationCap className="h-6 w-6" />
            {!isCollapsed && <span className="">Studious</span>}
          </Link>
          <Button variant="ghost" size="icon" className="ml-auto md:hidden" onClick={() => setIsSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto py-2">
            <nav className="grid items-start px-4 text-sm font-medium">
                <NavLink to="/" icon={<Home className="h-4 w-4" />} isCollapsed={isCollapsed}>Home</NavLink>
                <NavLink to="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} isCollapsed={isCollapsed}>대시보드</NavLink>
                <NavLink to="/review-deck" icon={<BrainCircuit className="h-4 w-4" />} isCollapsed={isCollapsed}>오늘의 복습</NavLink>
                <NavLink to="/notes" icon={<List className="h-4 w-4" />} isCollapsed={isCollapsed}>노트 목록</NavLink>
                <NavLink to="/schedule" icon={<Calendar className="h-4 w-4" />} isCollapsed={isCollapsed}>시간표</NavLink>
                <NavLink to="/assignment" icon={<GraduationCap className="h-4 w-4" />} isCollapsed={isCollapsed}>AI 과제</NavLink>
                <NavLink to="/settings" icon={<Settings className="h-4 w-4" />} isCollapsed={isCollapsed}>Settings</NavLink>
            </nav>
        </div>
        <div className="mt-auto border-t p-4">
            <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="w-full hidden md:flex justify-center">
                {isCollapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
            </Button>
        </div>
      </div>
    );
};

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const desktopSidebarWidth = isCollapsed ? "md:grid-cols-[60px_1fr]" : "md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]";
  const desktopMainContentPadding = isCollapsed ? "md:pl-[60px]" : "md:pl-[220px] lg:pl-[280px]";
  const desktopAsideWidth = isCollapsed ? "md:w-[60px]" : "md:w-[220px] lg:w-[280px]";

  return (
    <SidebarContext.Provider value={{ isSidebarOpen, setIsSidebarOpen }}>
        <div className={`grid min-h-screen w-full ${desktopSidebarWidth}`}>
            <aside className={`fixed inset-y-0 left-0 z-10 bg-muted/40 border-r md:block transition-all duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 ${desktopAsideWidth}`}>
                <SidebarContent isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(!isCollapsed)} />
            </aside>
            <div className={`flex flex-col transition-all duration-300 ease-in-out ${desktopMainContentPadding}`}>
                <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6 md:hidden">
                    <Button variant="outline" size="icon" className="shrink-0" onClick={() => setIsSidebarOpen(true)}>
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Toggle navigation menu</span>
                    </Button>
                </header>
                <main className="flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    </SidebarContext.Provider>
  );
};

export default AppLayout;