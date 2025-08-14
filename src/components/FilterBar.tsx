import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { Filters } from '../lib/useNotes';

type Props = {
  filters?: Filters;
  onFiltersChange: (next: Filters) => void;
  availableTopics?: string[];
};

export default function FilterBar({ filters, onFiltersChange, availableTopics = [] }: Props) {
  const [localSearch, setLocalSearch] = useState(filters?.search ?? '');
  const [selectedTopics, setSelectedTopics] = useState<string[]>(filters?.topics ?? []);
  const [isComposing, setIsComposing] = useState(false);
  const timerRef = useRef<number | null>(null);

  // propagate local search/topics (debounced)
  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      onFiltersChange({
        ...(filters || {}),
        search: localSearch || undefined,
        topics: selectedTopics.length ? selectedTopics : undefined,
        // favorite 필터는 UI에서 노출하지 않되 값은 유지
      });
    }, 200);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch, selectedTopics]);

  const toggleTopic = (t: string) => {
    setSelectedTopics(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Search className="h-4 w-4 text-gray-400" />
        <input
          value={localSearch}
          onChange={e => setLocalSearch(e.target.value)}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          placeholder="검색어를 입력하세요"
          className="flex-1 outline-none bg-transparent text-sm"
        />
      </div>

      {availableTopics.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {availableTopics.map(t => (
            <button
              key={t}
              onClick={() => toggleTopic(t)}
              className={`text-xs px-2 py-1 rounded border ${
                selectedTopics.includes(t)
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}