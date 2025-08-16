import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotes, type Filters } from '../lib/useNotes';
import NoteCard from '../components/NoteCard';
import FilterBar from '../components/FilterBar';
import { Plus, Settings, CalendarDays, Pin } from 'lucide-react';

function QuickRange({ value, onChange }:{ value: Filters['dateRange']; onChange:(v:Filters['dateRange'])=>void }){
  const opts: Array<{key: Filters['dateRange'], label: string}> = [
    { key: 'today', label: '오늘' },
    { key: '7days', label: '7일' },
    { key: '30days', label: '30일' },
    { key: 'all', label: '전체' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <CalendarDays className="h-4 w-4 text-gray-400" />
      {opts.map(o => (
        <button key={o.key}
          onClick={()=>onChange(o.key)}
          className={`px-2 py-1 rounded-full border transition-colors ${value===o.key ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

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

  const sorted = useMemo(() => {
    const arr = [...notes];
    arr.sort((a,b) => (b?.createdAt ?? 0) - (a?.createdAt ?? 0));
    if (!pinFav) return arr;
    const favs = arr.filter(n => !!n.favorite);
    const rest = arr.filter(n => !n.favorite);
    return [...favs, ...rest];
  }, [notes, pinFav]);

  const onRangeChange = (r: Filters['dateRange']) => {
    setFilters({ ...(filters||{}), dateRange: r });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* 헤더: 타이틀/서브타이틀 + 우측 액션(새 노트, 설정) */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SelfDev Notes</h1>
          <p className="text-sm text-gray-500 mt-1">자기계발 요약 &amp; 기록</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
          <Link to="/capture" className="inline-flex items-center justify-center gap-2 text-sm px-3 py-1 sm:px-4 sm:py-2 rounded-lg bg-teal-600 text-white shadow-sm hover:bg-teal-700 transition-colors w-full sm:w-auto">
            <Plus className="h-4 w-4" /> 새 노트
          </Link>
          <Link to="/settings" className="inline-flex items-center justify-center gap-2 text-sm px-3 py-1 sm:px-4 sm:py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 transition-colors w-full sm:w-auto">
            <Settings className="h-4 w-4" /> 설정
          </Link>
        </div>
      </header>

      {/* 필터 영역 */}
      <div className="bg-white/60 backdrop-blur-lg rounded-2xl shadow-lg border border-white/20 p-4 space-y-4">
        <FilterBar filters={filters} onFiltersChange={setFilters} availableTopics={availableTopics} />
        <div className="flex items-center justify-between">
          <QuickRange value={filters?.dateRange ?? 'all'} onChange={onRangeChange} />
          <button
            onClick={()=>setPinFav(v=>!v)}
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${pinFav ? 'bg-teal-100 border-teal-200 text-teal-800' : 'bg-white/70 border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            title="즐겨찾기 상단 고정"
          >
            <Pin className="h-3 w-3" /> 즐겨찾기 우선: {pinFav ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* 목록 */}
      {loading && <div className="text-center text-gray-500 py-20">불러오는 중…</div>}
      {!loading && sorted.length === 0 && <div className="text-center text-gray-500 py-20">노트가 없습니다. 오른쪽 상단의 “새 노트”를 눌러 추가해보세요.</div>}
      <div className="grid grid-cols-1 gap-3">
        {sorted.map(n => (
          <NoteCard key={n.id} note={n} onToggleFavorite={toggleFavorite} />
        ))}
      </div>
    </div>
  );
}