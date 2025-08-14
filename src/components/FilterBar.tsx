import React, { useEffect, useRef, useState } from 'react';
import { Search, Star } from 'lucide-react';
import type { Filters } from '../lib/useNotes';

type Props = {
  filters?: Filters;
  onFiltersChange: (next: Filters) => void;
  availableTopics?: string[];
};

export default function FilterBar({ filters, onFiltersChange, availableTopics = [] }: Props) {
  const [localSearch, setLocalSearch] = useState(filters?.search ?? '');
  const [selectedTopics, setSelectedTopics] = useState<string[]>(filters?.topics ?? []);
  const [favOnly, setFavOnly] = useState<boolean>(!!filters?.favorite);
  const [isComposing, setIsComposing] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // sync from props only if different
    if ((filters?.search ?? '') !== localSearch) setLocalSearch(filters?.search ?? '');
    if (JSON.stringify(filters?.topics ?? []) !== JSON.stringify(selectedTopics)) setSelectedTopics(filters?.topics ?? []);
    if (!!filters?.favorite !== favOnly) setFavOnly(!!filters?.favorite);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters?.search, JSON.stringify(filters?.topics ?? []), filters?.favorite]);

  useEffect(() => {
    if (isComposing) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const next: Filters = { search: localSearch, topics: selectedTopics, favorite: favOnly };
      onFiltersChange(next);
    }, 250);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [localSearch, selectedTopics, favOnly, isComposing]);

  const toggleTopic = (t: string) => {
    setSelectedTopics(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center gap-3">
        <Search className="h-4 w-4 text-gray-400" />
        <input
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          placeholder="검색어를 입력하세요"
          className="flex-1 outline-none bg-transparent text-sm"
        />
        <button
          onClick={() => setFavOnly(v => !v)}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-sm ${favOnly ? 'text-yellow-600 border-yellow-300 bg-yellow-50' : 'text-gray-600 border-gray-200 bg-white'}`}
          title="즐겨찾기만 보기"
        >
          <Star className={favOnly ? 'fill-yellow-400' : ''} />
          즐겨찾기
        </button>
      </div>
      {Array.isArray(availableTopics) && availableTopics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {availableTopics.map(t => (
            <button
              key={t}
              onClick={() => toggleTopic(t)}
              className={`text-xs px-2 py-1 rounded border ${selectedTopics.includes(t) ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-700 border-gray-200'}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
