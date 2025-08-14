import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotes, type Filters } from '../lib/useNotes';
import NoteCard from '../components/NoteCard';
import FilterBar from '../components/FilterBar';
import { Plus, CalendarDays, Pin } from 'lucide-react';

function QuickRange({ value, onChange }:{ value: Filters['dateRange']; onChange:(v:Filters['dateRange'])=>void }){
  const opts: Array<{key: Filters['dateRange'], label: string}> = [
    { key: 'today', label: '오늘' },
    { key: '7days', label: '7일' },
    { key: '30days', label: '30일' },
    { key: 'all', label: '전체' },
  ];
  return (
    <div className="flex items-center gap-2 text-xs">
      <CalendarDays className="h-4 w-4 text-gray-400" />
      {opts.map(o => (
        <button key={o.key}
          onClick={()=>onChange(o.key)}
          className={`px-2 py-1 rounded-full border ${value===o.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
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
    // createdAt desc first
    arr.sort((a,b) => (b?.createdAt ?? 0) - (a?.createdAt ?? 0));
    if (!pinFav) return arr;
    // Stable-ish favorites first
    const favs = arr.filter(n => !!n.favorite);
    const rest = arr.filter(n => !n.favorite);
    return [...favs, ...rest];
  }, [notes, pinFav]);

  const onRangeChange = (r: Filters['dateRange']) => {
    setFilters({ ...(filters||{}), dateRange: r });
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">노트</h1>
        <Link to="/capture" className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded bg-blue-600 text-white">
          <Plus className="h-4 w-4" /> 새 노트
        </Link>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
        <FilterBar filters={filters} onFiltersChange={setFilters} availableTopics={availableTopics} />

        <div className="flex items-center justify-between">
          <QuickRange value={filters?.dateRange ?? 'all'} onChange={onRangeChange} />
          <button
            onClick={()=>setPinFav(v=>!v)}
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${pinFav ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-white border-gray-200 text-gray-600'}`}
            title="즐겨찾기 상단 고정"
          >
            <Pin className="h-3 w-3" /> 즐겨찾기 우선: {pinFav ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {loading && <div className="text-center text-gray-500 py-20">불러오는 중…</div>}

      {!loading && sorted.length === 0 && (
        <div className="text-center text-gray-500 py-20">노트가 없습니다. 오른쪽 상단의 “새 노트”를 눌러 추가해보세요.</div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {sorted.map(n => (
          <NoteCard key={n.id} note={n} onToggleFavorite={toggleFavorite} />
        ))}
      </div>
    </div>
  );
}