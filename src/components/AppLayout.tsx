import React, { useState, createContext, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, Settings, X, List, Menu, Calendar, GraduationCap, LayoutDashboard, BrainCircuit } from 'lucide-react';
import { cn } from "@/lib/utils";
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/clerk-react";

import { Toaster } from 'react-hot-toast';

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

const NavLink = ({ to, icon, children, isCollapsed, onClick }: { to: string, icon: React.ReactNode, children: React.ReactNode, isCollapsed: boolean, onClick?: () => void }) => {
    const location = useLocation();
    const isActive = location.pathname === to;
    
    const linkClasses = cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
        isActive && "bg-muted text-primary",
        isCollapsed && "justify-center"
    );

    return (
      <Link to={to} title={isCollapsed ? String(children) : undefined} className={linkClasses} onClick={onClick}>
        {icon}
        {!isCollapsed && <span className="truncate">{children}</span>}
      </Link>
    );
};

// Added Clerk component types to SidebarContentProps
interface SidebarContentProps {
  isCollapsed: boolean;
  onCollapse?: () => void;
  isMobile?: boolean;
  onMobileCollapse?: () => void;
  onLinkClick?: () => void;
  SignedIn: typeof SignedIn;
  SignedOut: typeof SignedOut;
  SignInButton: typeof SignInButton;
  SignUpButton: typeof SignUpButton;
  UserButton: typeof UserButton;
}

const SidebarContent = ({ isCollapsed, onCollapse, isMobile, onMobileCollapse, onLinkClick, SignedIn, SignedOut, SignInButton, SignUpButton, UserButton }: SidebarContentProps) => {
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
                <NavLink to="/" icon={<Home className="h-5 w-5" />} isCollapsed={isCollapsed} onClick={onLinkClick}>Home</NavLink>
                <NavLink to="/dashboard" icon={<LayoutDashboard className="h-5 w-5" />} isCollapsed={isCollapsed} onClick={onLinkClick}>대시보드</NavLink>
                <NavLink to="/review-deck" icon={<BrainCircuit className="h-5 w-5" />} isCollapsed={isCollapsed} onClick={onLinkClick}>오늘의 복습</NavLink>
                <NavLink to="/notes" icon={<List className="h-5 w-5" />} isCollapsed={isCollapsed} onClick={onLinkClick}>노트 목록</NavLink>
                <NavLink to="/schedule" icon={<Calendar className="h-5 w-5" />} isCollapsed={isCollapsed} onClick={onLinkClick}>시간표</NavLink>
                <NavLink to="/assignment" icon={<GraduationCap className="h-5 w-5" />} isCollapsed={isCollapsed} onClick={onLinkClick}>AI 과제</NavLink>
                <NavLink to="/settings" icon={<Settings className="h-5 w-5" />} isCollapsed={isCollapsed} onClick={onLinkClick}>Settings</NavLink>
            </nav>
        </div>
        <div className="mt-auto p-4 border-t flex flex-col gap-2">
        {/* Clerk authentication buttons */}
        <SignedOut>
          <SignInButton mode="modal" className="w-full">
            <Button variant="secondary" className="w-full">로그인</Button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <UserButton afterSignOutUrl="/" appearance={{elements: {userButtonAvatarBox: "w-full h-full"}}} />
        </SignedIn>
        </div>
      </div>
    );
};

// Added Clerk component types to AppLayoutProps
interface AppLayoutProps {
  children: React.ReactNode;
  SignedIn: typeof SignedIn;
  SignedOut: typeof SignedOut;
  SignInButton: typeof SignInButton;
  SignUpButton: typeof SignUpButton;
  UserButton: typeof UserButton;
}

const AppLayout = ({ children, SignedIn, SignedOut, SignInButton, SignUpButton, UserButton }: AppLayoutProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(true);
  const [isMobileNavCollapsed, setIsMobileNavCollapsed] = useState(true);

  const location = useLocation();

  const handleLinkClick = () => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const desktopAsideWidth = isDesktopCollapsed ? "md:w-[70px]" : "md:w-[180px]";
  const desktopMainContentMargin = isDesktopCollapsed ? "md:ml-[70px]" : "md:ml-[180px]";
  const mobileAsideWidth = isMobileNavCollapsed ? "w-[70px]" : "w-[200px]";

  return (
    <SidebarContext.Provider value={{ isSidebarOpen, setIsSidebarOpen }}>
        <Toaster position="bottom-center" />
        <div className="flex flex-col h-screen w-full">
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
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                md:translate-x-0 ${desktopAsideWidth} ${mobileAsideWidth}`}>
                <SidebarContent 
                    isCollapsed={isDesktopCollapsed} 
                    onCollapse={() => setIsDesktopCollapsed(!isDesktopCollapsed)} 
                    isMobile={true}
                    onMobileCollapse={() => setIsMobileNavCollapsed(!isMobileNavCollapsed)}
                    onLinkClick={handleLinkClick}
                    SignedIn={SignedIn}
                    SignedOut={SignedOut}
                    SignInButton={SignInButton}
                    SignUpButton={SignUpButton}
                    UserButton={UserButton}
                />
            </aside>

            {/* Main Content */}
            <div className={`flex flex-col flex-1 h-full transition-all duration-300 ease-in-out ${desktopMainContentMargin}`}>
                <Button variant="outline" size="icon" className="shrink-0 md:hidden absolute top-2 left-2 z-50" onClick={() => setIsSidebarOpen(true)}>
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle navigation menu</span>
                </Button>

                {/* Page Content */}
                <main className={`flex-1 flex flex-col p-4 pt-12 sm:p-6 ${
                    ['/notes', '/review-deck', '/assignment', '/schedule'].includes(location.pathname)
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