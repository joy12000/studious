// src/pages/HomePage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotes } from '../lib/useNotes';
import NoteCard from '../components/NoteCard';
import FilterBar from '../components/FilterBar';
import PasteFAB from '../components/PasteFAB';
import ImportButton from '../components/ImportButton';
import { Pin, Plus, LayoutGrid, List } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * AIBOOK-UI: 홈페이지 컴포넌트입니다.
 * 노트 목록을 그리드 또는 리스트 뷰로 보여주는 기능과 필터링, 노트 추가 등의 액션을 포함합니다.
 * GEMINI: 모바일 뷰에서 헤더 레이아웃과 노트 목록 표시를 개선했습니다.
 */
export default function HomePage() {
  const { notes, loading, filters, setFilters, toggleFavorite, addNote } = useNotes();
  const navigate = useNavigate();
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [pinFav, setPinFav] = useState<boolean>(() => {
    try { return localStorage.getItem('pinFavorites') !== 'false'; } catch { return true; }
  });
  const [view, setView] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    const topics = new Set<string>();
    notes.forEach(note => (note.topics || []).forEach((t:string)=>topics.add(t)));
    setAvailableTopics(Array.from(topics).sort());
  }, [notes]);

  useEffect(()=>{
    try { localStorage.setItem('pinFavorites', String(pinFav)); } catch (e) {
      console.error("Failed to save pinFavorites to localStorage:", e);
    }
  }, [pinFav]);

  const sortedNotes = useMemo(() => {
    const arr = [...notes];
    arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (!pinFav) return arr;
    
    const favs = arr.filter(n => n.favorite);
    const rest = arr.filter(n => !n.favorite);
    return [...favs, ...rest];
  }, [notes, pinFav]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        navigate(`/capture?text=${encodeURIComponent(text)}`);
      } else {
        alert('클립보드에 텍스트가 없습니다.');
      }
    } catch (err) {
      console.error('클립보드 읽기 실패:', err);
      alert('클립보드를 읽는 데 실패했습니다. 브라우저 권한을 확인해주세요.');
    }
  };

  return (
    <>
      {/* AIBOOK-UI: 새롭게 디자인된 고정 헤더 */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b mb-6">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* GEMINI: 반응형 레이아웃으로 수정 (모바일: 수직, 데스크탑: 수평) */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            {/* 필터 바 */}
            <div className="flex-grow w-full">
              <FilterBar filters={filters} onFiltersChange={setFilters} availableTopics={availableTopics} />
            </div>
            
            {/* 액션 버튼 및 뷰 전환 토글 */}
            <div className="flex items-center gap-2">
              <TooltipProvider>
                {/* 뷰 전환 토글 */}
                <ToggleGroup type="single" value={view} onValueChange={(value) => { if (value) setView(value as 'grid' | 'list'); }} aria-label="View mode">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ToggleGroupItem value="grid" aria-label="Grid view">
                        <LayoutGrid className="h-5 w-5" />
                      </ToggleGroupItem>
                    </TooltipTrigger>
                    <TooltipContent><p>그리드 뷰</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ToggleGroupItem value="list" aria-label="List view">
                        <List className="h-5 w-5" />
                      </ToggleGroupItem>
                    </TooltipTrigger>
                    <TooltipContent><p>리스트 뷰</p></TooltipContent>
                  </Tooltip>
                </ToggleGroup>

                {/* 기타 액션 버튼 */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link to="/capture" className="p-2 text-foreground hover:bg-muted rounded-lg transition-colors">
                      <Plus className="h-5 w-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent><p>새 노트</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={()=>setPinFav(v=>!v)} className={`p-2 rounded-lg transition-colors ${pinFav ? 'text-primary bg-primary/10' : 'text-foreground hover:bg-muted'}`}>
                      <Pin className={`h-5 w-5 ${pinFav ? 'fill-current' : ''}`} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent><p>즐겨찾기 고정</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 영역 */}
      <main className="max-w-7xl mx-auto px-4">
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
        
        {/* AIBOOK-UI: 뷰 상태에 따라 동적으로 변경되는 노트 목록 레이아웃 */}
        <div className={view === 'grid' 
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" 
          : "flex flex-col gap-4"
        }>
          {sortedNotes.map(n => (
            // GEMINI: view prop을 NoteCard에 전달
            <NoteCard key={n.id} note={n} onToggleFavorite={toggleFavorite} view={view} />
          ))}
        </div>
      </main>

      {/* 플로팅 액션 버튼 */}
      <div className="fixed bottom-4 right-4 flex flex-row items-center gap-3">
        <ImportButton onImport={addNote} />
        <PasteFAB onClick={handlePaste} />
      </div>
    </>
  );
}
