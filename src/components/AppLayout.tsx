// src/components/AppLayout.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, Settings } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * AIBOOK-UI: 앱의 전체적인 레이아웃을 정의하는 컴포넌트입니다.
 * 좌측에는 사이드바 네비게이션, 우측에는 메인 콘텐츠 영역이 위치합니다.
 */
const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen bg-background">
      {/* 사이드바 */}
      <aside className="w-64 border-r bg-muted/40 p-4">
        <div className="flex h-full flex-col">
          {/* 로고 및 앱 이름 */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-primary">AIBook Beta</h1>
            <p className="text-sm text-muted-foreground">Your AI-Powered Notebook</p>
          </div>

          {/* 네비게이션 메뉴 */}
          <nav className="flex flex-col space-y-2">
            <Button asChild variant="ghost" className="justify-start">
              <Link to="/">
                <Home className="mr-2 h-4 w-4" />
                Home
              </Link>
            </Button>
            <Button asChild variant="ghost" className="justify-start">
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
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
