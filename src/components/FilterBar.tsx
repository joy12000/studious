import React, { useEffect, useRef, useState } from 'react';
import { Search, Calendar, Heart } from 'lucide-react';

interface FilterBarProps {
  filters: { search: string; topics: string[]; dateRange: 'today'|'7days'|'30days'|'all'; favorite: boolean; };
  onFiltersChange: (filters: any) => void;
  availableTopics: string[];
}
export default function FilterBar({ filters, onFiltersChange, availableTopics }: FilterBarProps) {
  const [localSearch, setLocalSearch] = useState(filters.search || '');
  const [isComposing, setIsComposing] = useState(false);
  const first = useRef(true);
  useEffect(() => { setLocalSearch(filters.search || ''); }, [filters.search]);
  useEffect(() => { if (first.current){ first.current=false; return; } if (isComposing) return;
    const t = setTimeout(()=>{ if (localSearch !== (filters.search || '')) onFiltersChange({ ...filters, search: localSearch }); }, 280);
    return ()=>clearTimeout(t);
  }, [localSearch, isComposing]);
  const toggleTopic = (t: string) => {
    const next = filters.topics.includes(t) ? filters.topics.filter(x=>x!==t) : [...filters.topics, t];
    onFiltersChange({ ...filters, topics: next });
  };
  return (<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
    <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
      <div className="flex items-center gap-2 flex-1 max-w-xl bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
        <Search className="w-4 h-4 text-gray-500" />
        <input value={localSearch} onChange={e=>setLocalSearch(e.target.value)}
               onKeyDown={e=>{ if (e.key==='Escape') setLocalSearch(''); }}
               onCompositionStart={()=>setIsComposing(true)}
               onCompositionEnd={e=>{ setIsComposing(false); setLocalSearch((e.target as HTMLInputElement).value);}}
               className="bg-transparent outline-none flex-1 text-sm" placeholder="제목, 내용, 주제, 라벨, 링크 검색" />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-sm">
          <Calendar className="w-4 h-4 text-gray-500" />
          <select value={filters.dateRange} onChange={e=>onFiltersChange({ ...filters, dateRange: e.target.value as any })}
                  className="text-sm border rounded px-2 py-1 bg-white">
            <option value="all">전체</option><option value="today">오늘</option><option value="7days">7일</option><option value="30days">30일</option>
          </select>
        </div>
        <button onClick={()=>onFiltersChange({ ...filters, favorite: !filters.favorite })}
                className={`flex items-center gap-1 text-sm px-2 py-1 rounded border ${filters.favorite ? 'text-red-600 border-red-200 bg-red-50' : 'text-gray-600 border-gray-200'}`} title="즐겨찾기만">
          <Heart className="w-4 h-4" />즐겨찾기
        </button>
      </div>
    </div>
    {!!availableTopics?.length && (<div className="mt-3 flex flex-wrap gap-2">
      {availableTopics.map(t=>{ const active=filters.topics.includes(t); return (
        <button key={t} onClick={()=>toggleTopic(t)} className={`px-2 py-1 rounded-full text-xs border ${active?'bg-blue-100 text-blue-700 border-blue-200':'bg-gray-50 text-gray-700 border-gray-200'}`}>{t}</button>
      );})}
    </div>)}
  </div>); }