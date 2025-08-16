import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotes, type Filters } from '../lib/useNotes';
import NoteCard from '../components/NoteCard';
import FilterBar from '../components/FilterBar';
import { Settings, Pin, Plus } from 'lucide-react';

// UI_IMPROVEMENT: 홈 화면 UI 개선
export default function HomePage() {
  const { notes, loading, filters, setFilters, toggleFavorite } = useNotes();
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [pinFav, setPinFav] = useState<boolean>(() => {
    try { return localStorage.getItem('pinFavorites') !== 'false'; } catch { return true; }
  });

  useEffect(() => {
    const topics = new Set<string>();
    notes.forEach(note => (note.topics || []).forEach((t:string)=>topics.add(t)));
    setAvailableTopics(Array.from(topics).sort());
  }, [notes]);

  useEffect(()=>{
    try { localStorage.setItem('pinFavorites', String(pinFav)); } catch {}
  }, [pinFav]);

  const sortedNotes = useMemo(() => {
    const arr = [...notes];
    // 최신순으로 먼저 정렬
    arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (!pinFav) return arr;
    
    // 즐겨찾기 상단 고정 로직
    const favs = arr.filter(n => n.favorite);
    const rest = arr.filter(n => !n.favorite);
    return [...favs, ...rest];
  }, [notes, pinFav]);

  return (
    <div className="min-h-screen bg-background">
      {/* UI_IMPROVEMENT: NotePage와 일관성을 맞춘 고정 헤더 추가 */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-foreground">내 노트</h1>
            <div className="flex items-center gap-2">
              <Link
                to="/capture"
                className="p-2 text-foreground hover:bg-muted rounded-lg transition-colors"
                title="새 노트"
              >
                <Plus className="h-5 w-5" />
              </Link>
              <button
                onClick={()=>setPinFav(v=>!v)}
                className={`p-2 rounded-lg transition-colors ${pinFav ? 'text-primary bg-primary/10' : 'text-foreground hover:bg-muted'}`}
                title="즐겨찾기 상단 고정"
              >
                <Pin className={`h-5 w-5 ${pinFav ? 'fill-current' : ''}`} />
              </button>
              <Link
                to="/settings"
                className="p-2 text-foreground hover:bg-muted rounded-lg transition-colors"
                title="설정"
              >
                <Settings className="h-5 w-5" />
              </Link>
            </div>
          </div>
          {/* UI_IMPROVEMENT: 필터 바를 헤더 안으로 이동 */}
          <FilterBar filters={filters} onFiltersChange={setFilters} availableTopics={availableTopics} />
        </div>
      </header>

      {/* UI_IMPROVEMENT: NotePage와 일관성을 맞춘 메인 콘텐츠 영역 */}
      <main className="max-w-7xl mx-auto px-4 py-8">
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
        
        {/* UI_IMPROVEMENT: 반응형 그리드 레이아웃으로 노트 목록 표시 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedNotes.map(n => (
            <NoteCard key={n.id} note={n} onToggleFavorite={toggleFavorite} />
          ))}
        </div>
      </main>
    </div>
  );
}