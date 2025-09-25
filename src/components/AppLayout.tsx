import React, { useState, createContext, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, Settings, X, List, Menu, Calendar, GraduationCap, LayoutDashboard, BrainCircuit } from 'lucide-react';
import { cn } from "@/lib/utils";

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
    
    const linkClasses = cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
        isActive && "bg-muted text-primary",
        isCollapsed && "justify-center"
    );

    return (
      <Link to={to} title={isCollapsed ? String(children) : undefined} className={linkClasses}>
        {icon}
        {!isCollapsed && <span className="truncate">{children}</span>}
      </Link>
    );
};

const SidebarContent = ({ isCollapsed }: { isCollapsed: boolean }) => {
    const { setIsSidebarOpen } = useSidebar();
    return (
      <div className="flex h-full max-h-screen flex-col">
        <div className={cn("flex h-16 items-center border-b px-6 lg:h-[68px]", isCollapsed && "justify-center px-2")}>
          <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <GraduationCap className="h-6 w-6" />
            {!isCollapsed && <span className="">Studious</span>}
          </Link>
          <Button variant="ghost" size="icon" className="ml-auto md:hidden" onClick={() => setIsSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto py-4">
            <nav className="grid items-start px-2 text-sm font-medium gap-1">
                <NavLink to="/" icon={<Home className="h-5 w-5" />} isCollapsed={isCollapsed}>Home</NavLink>
                <NavLink to="/dashboard" icon={<LayoutDashboard className="h-5 w-5" />} isCollapsed={isCollapsed}>대시보드</NavLink>
                <NavLink to="/review-deck" icon={<BrainCircuit className="h-5 w-5" />} isCollapsed={isCollapsed}>오늘의 복습</NavLink>
                <NavLink to="/notes" icon={<List className="h-5 w-5" />} isCollapsed={isCollapsed}>노트 목록</NavLink>
                <NavLink to="/schedule" icon={<Calendar className="h-5 w-5" />} isCollapsed={isCollapsed}>시간표</NavLink>
                <NavLink to="/assignment" icon={<GraduationCap className="h-5 w-5" />} isCollapsed={isCollapsed}>AI 과제</NavLink>
                <NavLink to="/settings" icon={<Settings className="h-5 w-5" />} isCollapsed={isCollapsed}>Settings</NavLink>
            </nav>
        </div>
      </div>
    );
};

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true); // 기본 상태를 '접힘'으로 변경

  const desktopAsideWidth = isCollapsed ? "md:w-[70px]" : "md:w-[256px]";
  const desktopMainContentMargin = isCollapsed ? "md:ml-[70px]" : "md:ml-[256px]";

  return (
    <SidebarContext.Provider value={{ isSidebarOpen, setIsSidebarOpen }}>
        <div className="min-h-screen w-full">
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 z-30 bg-black/60 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
                        <aside 
                            className={`fixed inset-y-0 left-0 z-40 border-r transition-all duration-300 ease-in-out bg-muted dark:bg-background
                            ${isSidebarOpen ? 'translate-x-0 w-[256px]' : '-translate-x-full'}
                            md:translate-x-0 ${desktopAsideWidth}`}
                            onMouseEnter={() => setIsCollapsed(false)}                onMouseLeave={() => setIsCollapsed(true)}
            >
                <SidebarContent isCollapsed={isCollapsed} />
            </aside>

            {/* Main Content */}
            <div className={`flex flex-col transition-all duration-300 ease-in-out ${desktopMainContentMargin}`}>
                {/* Mobile Header */}
                <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6 md:hidden">
                    <Button variant="outline" size="icon" className="shrink-0" onClick={() => setIsSidebarOpen(true)}>
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Toggle navigation menu</span>
                    </Button>
                    <Link to="/" className="text-lg font-semibold">Studious</Link>
                </header>

                {/* Page Content */}
                <main className={`flex-1 flex flex-col p-4 sm:p-6 ${
                    ['/notes', '/review-deck', '/assignment', '/schedule'].includes(useLocation().pathname)
                        ? 'overflow-y-auto'
                        : ''
                }`}>
                    {children}
                </main>
            </div>
        </div>
    </SidebarContext.Provider>
  );
};

export default AppLayout;