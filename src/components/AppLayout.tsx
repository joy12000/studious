import React, { useState, createContext, useContext, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, Settings, X, List, ChevronsLeft, ChevronsRight, Notebook } from 'lucide-react';
import { useNotes } from '../lib/useNotes'; // 🚀 노트 목록을 가져오기 위해 추가

// 사이드바 상태 공유를 위한 Context (기존과 동일)
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

// 🚀 사이드바 컨텐츠를 별도 컴포넌트로 분리하여 로직을 더 명확하게 관리
const SidebarContent = ({ isCollapsed, onToggleCollapse }: { isCollapsed: boolean, onToggleCollapse: () => void }) => {
  const { notes } = useNotes();
  const { setIsSidebarOpen } = useSidebar();
  const location = useLocation();

  const handleLinkClick = () => {
    if (window.innerWidth < 768) { // 모바일 화면에서만 링크 클릭 시 사이드바 닫기
      setIsSidebarOpen(false);
    }
  };

  // 🚀 최신 노트 7개만 선택
  const recentNotes = useMemo(() => notes, [notes]);

  const NavLink = ({ to, icon, children }: { to: string, icon: React.ReactNode, children: React.ReactNode }) => {
    const isActive = location.pathname === to;
    return (
      <Button asChild variant={isActive ? "secondary" : "ghost"} className="justify-start" onClick={handleLinkClick}>
        <Link to={to} className="flex items-center w-full">
          {icon}
          {!isCollapsed && <span className="ml-2 truncate">{children}</span>}
        </Link>
      </Button>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-8 flex items-center justify-between">
        <div className={`font-bold text-primary transition-all duration-300 ${isCollapsed ? 'text-lg' : 'text-2xl'}`}>
          <Link to="/" onClick={handleLinkClick}>{isCollapsed ? 'A' : 'Aibrary'}</Link>
        </div>
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsSidebarOpen(false)}>
          <X className="h-6 w-6" />
        </Button>
      </div>

      {/* 메인 네비게이션 */}
      <nav className="flex flex-col space-y-2">
        <NavLink to="/" icon={<Home className="h-4 w-4" />}>Home</NavLink>
        <NavLink to="/notes" icon={<List className="h-4 w-4" />}>노트 목록</NavLink>
        <NavLink to="/settings" icon={<Settings className="h-4 w-4" />}>Settings</NavLink>
      </nav>

      <hr className="my-6" />

      {/* 🚀 최근 노트 목록 */}
      <div className="flex-1 overflow-y-auto">
        <h2 className={`text-sm font-semibold text-muted-foreground mb-3 px-4 transition-opacity ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>최근 노트</h2>
        <nav className="flex flex-col space-y-2">
          {recentNotes.map(note => (
            <NavLink key={note.id} to={`/note/${note.id}`} icon={<Notebook className="h-4 w-4 flex-shrink-0" />}>
              {note.title}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* 사이드바 하단 */}
      <div className="mt-auto pt-4">
        <Button variant="ghost" onClick={onToggleCollapse} className="w-full justify-start hidden md:flex">
          {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!isCollapsed && <span className="ml-2">Collapse</span>}
        </Button>
        <p className={`text-xs text-muted-foreground mt-2 transition-opacity ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>v1.0.0</p>
      </div>
    </div>
  );
};


const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false); // 🚀 데스크탑 접기 상태

  return (
    <SidebarContext.Provider value={{ isSidebarOpen, setIsSidebarOpen }}>
      <div className="relative h-screen md:flex bg-background">
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/60 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* 🚀 사이드바 스타일 및 기능 개선 */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 border-r bg-background/95 backdrop-blur-lg p-4 transform transition-all duration-300 ease-in-out md:relative md:translate-x-0 shadow-xl
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            ${isCollapsed ? 'md:w-20' : 'md:w-64'}` // 데스크탑 접기/펼치기 너비
          }
        >
          <SidebarContent isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(!isCollapsed)} />
        </aside>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  );
};

export default AppLayout;