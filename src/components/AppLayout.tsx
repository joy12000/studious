// src/components/AppLayout.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, Settings, Menu, X } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * AIBOOK-UI: 앱의 전체적인 레이아웃을 정의하는 컴포넌트입니다.
 * 데스크탑에서는 사이드바가 고정되며, 모바일에서는 오프캔버스 메뉴로 동작합니다.
 */
const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* 로고 및 앱 이름 */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">AIBook Beta</h1>
          <p className="text-sm text-muted-foreground">Your AI-Powered Notebook</p>
        </div>
        {/* 모바일에서 닫기 버튼 */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      {/* 네비게이션 메뉴 */}
      <nav className="flex flex-col space-y-2">
        <Button asChild variant="ghost" className="justify-start" onClick={() => setIsSidebarOpen(false)}>
          <Link to="/">
            <Home className="mr-2 h-4 w-4" />
            Home
          </Link>
        </Button>
        <Button asChild variant="ghost" className="justify-start" onClick={() => setIsSidebarOpen(false)}>
          <Link to="/settings">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </Button>
      </nav>

      {/* 사이드바 하단 (버전 정보 등) */}
      <div className="mt-auto">
        <p className="text-xs text-muted-foreground">v1.0.0 - UI Revamp</p>
      </div>
    </div>
  );

  return (
    <div className="relative h-screen md:flex bg-background">
      {/* 오버레이: 모바일에서 사이드바 열렸을 때 */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r bg-muted/95 backdrop-blur-lg p-4 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <SidebarContent />
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* 모바일 헤더 */}
        <header className="md:hidden mb-4 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>
          <h2 className="ml-4 text-lg font-semibold">AIBook</h2>
        </header>
        
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
