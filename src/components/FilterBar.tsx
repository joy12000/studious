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
    <div className="space-y-4">
      <div className="flex items-center gap-3 border-b border-gray-500/20 pb-3">
        <Search className="h-5 w-5 text-gray-500" />
        <input
          value={localSearch}
          onChange={e => setLocalSearch(e.target.value)}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          placeholder="노트 검색..."
          className="flex-1 outline-none bg-transparent text-base placeholder-gray-500"
        />
      </div>

      {availableTopics.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {availableTopics.map(t => (
            <button
              key={t}
              onClick={() => toggleTopic(t)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                selectedTopics.includes(t)
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white/60 text-gray-800 border-gray-200/80 hover:bg-white/90'
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