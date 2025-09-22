// src/pages/NoteListPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotes, Filters } from '../lib/useNotes'; // ✨ Filters 타입 임포트
import NoteCard from '../components/NoteCard';
import { Plus, LayoutGrid, List, Menu, Search, X, Youtube, BrainCircuit, Notebook } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebar } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';

export default function NoteListPage() {
  const { notes, loading, filters, setFilters, toggleFavorite } = useNotes();
  const { setIsSidebarOpen } = useSidebar();
  const navigate = useNavigate();
  
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [localSearch, setLocalSearch] = useState(filters.search || '');

  // 검색어 입력 시 디바운스를 적용하여 필터 업데이트
  useEffect(() => {
    const handler = setTimeout(() => {
      setFilters({ ...filters, search: localSearch || undefined });
    }, 300);
    return () => clearTimeout(handler);
  }, [localSearch, setFilters]);

  const sortedNotes = useMemo(() => {
    const arr = [...notes];
    arr.sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return arr;
  }, [notes]);
  
  const handleNoteTypeFilter = (type: 'general' | 'review' | 'textbook' | undefined) => {
    setFilters({ ...filters, noteType: type });
  };
  
  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="md:hidden h-10 w-10" onClick={() => setIsSidebarOpen(true)}>
                  <Menu className="h-6 w-6" />
                </Button>
                <h1 className="text-xl font-bold">내 노트</h1>
              </div>
              <div className="flex items-center gap-2">
                <TooltipProvider>
                    <ToggleGroup type="single" value={view} onValueChange={(value) => { if (value) setView(value as 'grid' | 'list'); }}>
                        <Tooltip><TooltipTrigger asChild><ToggleGroupItem value="grid"><LayoutGrid className="h-5 w-5" /></ToggleGroupItem></TooltipTrigger><TooltipContent><p>그리드 뷰</p></TooltipContent></Tooltip>
                        <Tooltip><TooltipTrigger asChild><ToggleGroupItem value="list"><List className="h-5 w-5" /></ToggleGroupItem></TooltipTrigger><TooltipContent><p>리스트 뷰</p></TooltipContent></Tooltip>
                    </ToggleGroup>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                                <Plus className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>새 노트 만들기</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* ✨ [개선] 검색 및 노트 타입 필터 */}
            <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        value={localSearch}
                        onChange={e => setLocalSearch(e.target.value)}
                        placeholder="노트 제목 및 내용 검색..."
                        className="w-full pl-9 pr-8 py-2 border bg-background rounded-full text-sm"
                    />
                    {localSearch && (
                        <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setLocalSearch('')}>
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
                <ToggleGroup 
                    type="single" 
                    value={filters.noteType} 
                    onValueChange={(value) => handleNoteTypeFilter(value as any)}
                    className="justify-start"
                >
                    <ToggleGroupItem value="textbook" aria-label="Textbooks"><BrainCircuit className="h-4 w-4 mr-1.5"/>참고서</ToggleGroupItem>
                    <ToggleGroupItem value="review" aria-label="Reviews"><BrainCircuit className="h-4 w-4 mr-1.5"/>복습</ToggleGroupItem>
                    <ToggleGroupItem value="general" aria-label="General Notes"><Youtube className="h-4 w-4 mr-1.5"/>요약</ToggleGroupItem>
                </ToggleGroup>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-7xl mx-auto">
          {loading && (
            <div className="text-center text-muted-foreground py-20">
              <p>노트를 불러오는 중...</p>
            </div>
          )}
          {!loading && sortedNotes.length === 0 && (
            <div className="text-center text-muted-foreground py-20">
              <h2 className="text-lg font-semibold">노트가 없습니다</h2>
              <p className="mt-2">홈 화면에서 새로운 노트를 만들어보세요.</p>
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
    </div>
  );
}