import React, { useState, createContext, useContext, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, Settings, X, List, ChevronsLeft, ChevronsRight, Notebook, Menu, Calendar, GraduationCap, LayoutDashboard, BrainCircuit } from 'lucide-react'; // 🧠, 📈 아이콘 임포트
import { useNotes } from '../lib/useNotes';

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

const SidebarContent = ({ isCollapsed, onToggleCollapse }: { isCollapsed: boolean, onToggleCollapse: () => void }) => {
  const { notes } = useNotes();
  const { setIsSidebarOpen } = useSidebar();
  const location = useLocation();

  const handleLinkClick = () => {
    if (window.innerWidth < 768) { // 모바일 화면에서만 링크 클릭 시 사이드바 닫기
      setIsSidebarOpen(false);
    }
  };

  const recentNotes = useMemo(() => notes, [notes]);

  const NavLink = ({ to, icon, children }: { to: string, icon: React.ReactNode, children: React.ReactNode }) => {
    const isActive = location.pathname === to;
    return (
      <Button asChild variant={isActive ? "secondary" : "ghost"} className="justify-start" onClick={handleLinkClick}>
        <Link to={to} className="flex items-center w-full">
          {icon}
          {!isCollapsed && <span className="ml-2 truncate min-w-0">{children}</span>}
        </Link>
      </Button>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-8 flex items-center justify-between">
        <div className={`font-bold text-primary transition-all duration-300 ${isCollapsed ? 'w-full flex justify-center text-2xl' : 'text-2xl'}`}>
          {isCollapsed ? (
            <div onClick={onToggleCollapse} className="cursor-pointer p-2 -m-2" title="사이드바 펼치기">
              S
            </div>
          ) : (
            <Link to="/" onClick={handleLinkClick}>studious</Link>
          )}
        </div>
        
        {/* 펼친 상태의 데스크탑 접기 버튼 (상단) */}
        {!isCollapsed && (
          <Button variant="ghost" onClick={onToggleCollapse} className="hidden md:flex items-center px-2 py-1 h-auto">
            <ChevronsLeft className="h-5 w-5" />
          </Button>
        )}

        {/* 모바일 닫기 버튼 */}
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsSidebarOpen(false)}>
          <X className="h-6 w-6" />
        </Button>
      </div>

                  {/* 메인 네비게이션 */}
                  <nav className="flex flex-col space-y-2">
                      <NavLink to="/" icon={<Home className="h-4 w-4" />}>Home</NavLink>
                      <NavLink to="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>대시보드</NavLink> {/* 📈 대시보드 링크 추가 */}
                      <NavLink to="/review-deck" icon={<BrainCircuit className="h-4 w-4" />}>오늘의 복습</NavLink> {/* 🧠 복습 덱 링크 추가 */}
                      <NavLink to="/notes" icon={<List className="h-4 w-4" />}>노트 목록</NavLink>
                      <NavLink to="/schedule" icon={<Calendar className="h-4 w-4" />}>시간표</NavLink>
                      <NavLink to="/assignment" icon={<GraduationCap className="h-4 w-4" />}>AI 과제</NavLink>
                      <NavLink to="/settings" icon={<Settings className="h-4 w-4" />}>Settings</NavLink>
                  </nav>
      <hr className="my-6" />

      {/* 최근 노트 목록 */}
      <div className="flex-1 overflow-y-auto">
        <h2 className={`text-sm font-semibold text-muted-foreground mb-3 px-4 transition-opacity ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
          최근 노트
        </h2>
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
        <p className={`text-xs text-muted-foreground mt-2 text-center w-full transition-opacity ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
          
        </p>
      </div>
    </div>
  );
};

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false); // 데스크탑 접기 상태
  const location = useLocation();

  // 노트 상세 페이지, 노트 목록, 설정 페이지에서는 메뉴 버튼 숨김
  const isNotePage = location.pathname.startsWith('/note/');
  const isNoteListPage = location.pathname === '/notes';
  const isSettingsPage = location.pathname === '/settings';

  const showMenuButton = !(isNotePage || isNoteListPage || isSettingsPage);

  return (
    <SidebarContext.Provider value={{ isSidebarOpen, setIsSidebarOpen }}>
      <div className="relative h-screen md:flex bg-background">
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/60 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <aside
          className={`w-4/5 max-w-sm fixed inset-y-0 left-0 z-40 border-r bg-background/95 backdrop-blur-lg p-4 transform transition-all duration-300 ease-in-out md:relative md:translate-x-0 shadow-xl
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            ${isCollapsed ? 'md:w-20' : 'md:w-64'}`}
        >
          <SidebarContent isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(!isCollapsed)} />
        </aside>

        <main className="flex-1 overflow-y-auto relative">
          {showMenuButton && (
            <Button
              onClick={() => setIsSidebarOpen(true)}
              variant="ghost"
              size="icon"
              className="absolute top-3 left-4 z-20 md:hidden" // 모바일에서만 보이도록
            >
              <Menu className="h-7 w-7" />
            </Button>
          )}
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  );
};

export default AppLayout;