
import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Filters } from '../lib/useNotes';

// 🚀 Props 변경: availableTopics -> availableTags
// 🚀 Filters 타입에 tag 추가 (useNotes.ts에도 추가 필요)
interface ExtendedFilters extends Filters {
  tag?: string;
}

type Props = {
  filters?: ExtendedFilters;
  onFiltersChange: (next: ExtendedFilters) => void;
  availableTags?: string[];
};

export default function FilterBar({ filters, onFiltersChange, availableTags = [] }: Props) {
  const [localSearch, setLocalSearch] = useState(filters?.search ?? '');
  // 🚀 단일 태그 선택으로 변경
  const [selectedTag, setSelectedTag] = useState<string | undefined>(filters?.tag);
  const timerRef = useRef<number | null>(null);

  // propagate local search/tag (debounced)
  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      onFiltersChange({
        ...(filters || {}),
        search: localSearch || undefined,
        tag: selectedTag,
      });
    }, 200);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch, selectedTag]);

  const selectTag = (t: string) => {
    // 🚀 이미 선택된 태그를 다시 클릭하면 선택 해제
    setSelectedTag(prev => prev === t ? undefined : t);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 border-b border-gray-500/20 pb-3">
        <Search className="h-5 w-5 text-gray-500" />
        <input
          value={localSearch}
          onChange={e => setLocalSearch(e.target.value)}
          placeholder="노트 검색..."
          className="flex-1 outline-none bg-transparent text-base placeholder-gray-500"
        />
        {localSearch && (
            <button onClick={() => setLocalSearch('')} className="p-1 rounded-full hover:bg-gray-200">
                <X className="h-4 w-4 text-gray-500" />
            </button>
        )}
      </div>

      {availableTags.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {availableTags.map(t => (
            <button
              key={t}
              onClick={() => selectTag(t)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                selectedTag === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-card-foreground border hover:bg-muted'
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
