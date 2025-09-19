// src/pages/HomePage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotes } from '../lib/useNotes';
import NoteCard from '../components/NoteCard';
import FilterBar from '../components/FilterBar';
import ImportButton from '../components/ImportButton';
import { Pin, Plus, LayoutGrid, List, Menu } from 'lucide-react'; // GEMINI: Menu 아이콘 추가
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebar } from '@/components/AppLayout'; // GEMINI: useSidebar 훅 임포트
import { Button } from '@/components/ui/button'; // GEMINI: Button 임포트

/**
 * AIBOK-UI: 홈페이지 컴포넌트입니다.
 * 노트 목록을 그리드 또는 리스트 뷰로 보여주는 기능과 필터링, 노트 추가 등의 액션을 포함합니다.
 * GEMINI: AppLayout에서 분리된 헤더를 자체적으로 구현하고 모바일 레이아웃을 최적화했습니다.
 */
export default function NoteListPage() { // 이름 변경: HomePage -> NoteListPage
  const { notes, loading, allTags, filters, setFilters, toggleFavorite } = useNotes();
  const { setIsSidebarOpen } = useSidebar();
  const navigate = useNavigate();
  
  const [view, setView] = useState<'grid' | 'list'>('grid');

  

  

  const sortedNotes = useMemo(() => {
    const arr = [...notes];
    arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    const favs = arr.filter(n => n.favorite);
    const rest = arr.filter(n => !n.favorite);
    return [...favs, ...rest];
  }, [notes]);

  return (
    <div className="flex h-full flex-col">
      {/* GEMINI: HomePage의 새로운 통합 헤더 */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col gap-4">
            {/* 상단 행: 메뉴 버튼, 타이틀, 액션 버튼 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-10 w-10" // 데스크탑에서는 숨김, 버튼 크기 증가
                  onClick={() => setIsSidebarOpen(true)}
                >
                  <Menu className="h-6 w-6" /> {/* 아이콘 크기 증가 */}
                </Button>
                <h1 className="text-xl font-bold">내 노트</h1>
              </div>
              
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <ToggleGroup type="single" value={view} onValueChange={(value) => { if (value) setView(value as 'grid' | 'list'); }} aria-label="View mode">
                    <Tooltip>
                      <TooltipTrigger asChild><ToggleGroupItem value="grid" aria-label="Grid view"><LayoutGrid className="h-5 w-5" /></ToggleGroupItem></TooltipTrigger>
                      <TooltipContent><p>그리드 뷰</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild><ToggleGroupItem value="list" aria-label="List view"><List className="h-5 w-5" /></ToggleGroupItem></TooltipTrigger>
                      <TooltipContent><p>리스트 뷰</p></TooltipContent>
                    </Tooltip>
                  </ToggleGroup>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={() => navigate('/', { state: { focusInput: true } })} className="p-2 text-foreground hover:bg-muted rounded-lg transition-colors">
                        <Plus className="h-5 w-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent><p>새 영상 요약</p></TooltipContent>
                  </Tooltip>
                  
                </TooltipProvider>
              </div>
            </div>
            {/* 하단 행: 필터 바 */}
            <div className="w-full mt-2">
              <FilterBar filters={filters} onFiltersChange={setFilters} availableTags={allTags} />
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 영역 */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-7xl mx-auto">
          {loading && (
            <div className="text-center text-muted-foreground py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p>노트를 불러오는 중...</p>
            </div>
          )}
          {!loading && sortedNotes.length === 0 && (
            <div className="text-center text-muted-foreground py-20">
              <h2 className="text-lg font-semibold">노트가 없습니다</h2>
              <p className="mt-2">화면 오른쪽 아래의 붙여넣기 버튼으로 새 노트를 추가해보세요.</p>
            </div>
          )}
          
          <div className={view === 'grid' 
            ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4" 
            : "grid grid-cols-1 md:grid-cols-2 gap-4"
          }>
            {sortedNotes.map(n => (
              <NoteCard key={n.id} note={n} onToggleFavorite={toggleFavorite} view={view} />
            ))}
          </div>
        </div>
      </main>

      {/* 플로팅 액션 버튼 */}
      <div className="fixed bottom-4 right-4 flex flex-row items-center gap-3">
        <ImportButton />
      </div>
    </div>
  );
}