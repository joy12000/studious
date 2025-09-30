// src/pages/NoteListPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotes } from '../lib/useNotes';
import NoteCard from '../components/NoteCard';
import { Plus, LayoutGrid, List, Search, X, Youtube, BrainCircuit, Notebook, RefreshCw } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { useAuth } from '@clerk/clerk-react';
import { syncNotes } from '../lib/sync';
import toast from 'react-hot-toast';

export default function NoteListPage() {
  const { notes, loading, filters, setFilters, toggleFavorite, importNote } = useNotes();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (!getToken) return;

    setIsSyncing(true);
    const toastId = toast.loading('Supabase와 노트 동기화를 시작합니다...');

    try {
      const result = await syncNotes(getToken);
      toast.success(`동기화 완료! (추가/업데이트: ${result.addedOrUpdated}, 삭제: ${result.deleted})`, { id: toastId });
    } catch (error) {
      console.error("Sync failed", error);
      toast.error(error instanceof Error ? error.message : '알 수 없는 오류로 동기화에 실패했습니다.', { id: toastId });
    }

    setIsSyncing(false);
  };

  const handleAddNewEmptyNote = async () => {
    const newNote = await importNote({
      title: '빈 노트 (테스트)',
      content: '# 제목\n\n여기에 내용을 입력하세요.',
    });
    navigate(`/note/${newNote.id}`);
  };
  
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [localSearch, setLocalSearch] = useState(filters.search || '');

  useEffect(() => {
    const handler = setTimeout(() => {
      setFilters({ ...filters, search: localSearch || undefined });
    }, 300);
    return () => clearTimeout(handler);
  }, [localSearch, setFilters]);

  const sortedNotes = useMemo(() => {
    if (!notes) return [];
    const arr = [...notes];
    arr.sort((a, b) => a.title.localeCompare(b.title)); // Sort alphabetically by title
    return arr;
  }, [notes]);
  
  const handleNoteTypeFilter = (type: 'general' | 'review' | 'textbook' | 'assignment' | undefined) => {
    setFilters({ ...filters, noteType: type });
  };
  
  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">내 노트</h1>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handleSync} disabled={isSyncing} title="Supabase와 동기화">
                    <RefreshCw className={`h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} />
                </Button>
                <ToggleGroup type="single" value={view} onValueChange={(value) => { if (value) setView(value as 'grid' | 'list'); }}>
                    <ToggleGroupItem value="grid"><LayoutGrid className="h-5 w-5" /></ToggleGroupItem>
                    <ToggleGroupItem value="list"><List className="h-5 w-5" /></ToggleGroupItem>
                </ToggleGroup>
                <Button variant="outline" size="icon" onClick={handleAddNewEmptyNote} title="빈 노트 추가 (테스트용)">
                    <Notebook className="h-5 w-5" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => navigate('/')}>
                    <Plus className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <div className="flex-1 relative w-full sm:w-auto">
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
                    className="justify-start w-full sm:w-auto"
                >
                    <ToggleGroupItem value="textbook" aria-label="Textbooks"><BrainCircuit className="h-4 w-4 mr-1.5"/>참고서</ToggleGroupItem>
                    <ToggleGroupItem value="review" aria-label="Reviews"><Notebook className="h-4 w-4 mr-1.5"/>복습</ToggleGroupItem>
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
            ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4" // 👈 간격과 컬럼 수 조정
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