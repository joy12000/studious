import React, { useEffect, useRef, useState } from 'react';
import { Search, Star } from 'lucide-react';
import TopicBadge from './TopicBadge';

export type FilterState = {
  search?: string;
  topics?: string[];
  favorite?: boolean;
  dateRange?: 'today'|'7days'|'30days'|'all';
};

export default function FilterBar({ topics, value, onChange }:{ topics:string[]; value:FilterState; onChange:(v:FilterState)=>void }){
  const [localSearch, setLocalSearch] = useState(value.search || '');
  const [selectedTopics, setSelectedTopics] = useState<string[]>(value.topics || []);
  const [favOnly, setFavOnly] = useState(!!value.favorite);
  const [range, setRange] = useState<FilterState['dateRange']>(value.dateRange || 'all');
  const [isComposing, setIsComposing] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(()=>{
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(()=>{
      onChange({ search: localSearch, topics: selectedTopics, favorite: favOnly, dateRange: range });
    }, 200);
    return ()=>{ if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [localSearch, selectedTopics, favOnly, range]);

  const toggleTopic = (t:string)=>{
    setSelectedTopics(prev => prev.includes(t) ? prev.filter(x=>x!==t) : [...prev, t]);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center gap-3">
        <Search className="h-4 w-4 text-gray-400" />
        <input
          value={localSearch}
          onChange={e=>setLocalSearch(e.target.value)}
          onCompositionStart={()=>setIsComposing(true)}
          onCompositionEnd={()=>{ setIsComposing(false); }}
          placeholder="검색(제목/내용)"
          className="flex-1 outline-none bg-transparent text-sm"
        />
        <button
          onClick={()=>setFavOnly(v=>!v)}
          className={`text-xs px-2 py-1 border rounded ${favOnly?'bg-yellow-100 border-yellow-300':'bg-white border-gray-200'}`}
          title="즐겨찾기만"
        >
          <Star className="inline h-3 w-3 mr-1" /> {favOnly?'ON':'OFF'}
        </button>
        <select className="text-xs border rounded px-2 py-1" value={range} onChange={e=>setRange(e.target.value as any)}>
          <option value="all">전체</option>
          <option value="today">오늘</option>
          <option value="7days">7일</option>
          <option value="30days">30일</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {topics.map(t=>(
          <TopicBadge key={t} label={t} active={selectedTopics.includes(t)} onClick={()=>toggleTopic(t)} />
        ))}
      </div>
    </div>
  )
}
