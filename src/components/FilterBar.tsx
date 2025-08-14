import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

type Filters = {
  search?: string;
  topics?: string[];
  favoritesOnly?: boolean;
  [key: string]: any;
};

type Props = {
  filters?: Filters;
  onFiltersChange: (next: Filters) => void;
  availableTopics?: string[];
};

export default function FilterBar({ filters = {}, onFiltersChange, availableTopics = [] }: Props) {
  const [localSearch, setLocalSearch] = useState<string>(filters.search ?? '');
  const [isComposing, setIsComposing] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    setLocalSearch(filters.search ?? '');
  }, [filters.search]);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (isComposing) return;
    const t = setTimeout(() => {
      if ((filters.search ?? '') !== localSearch) {
        onFiltersChange({ ...filters, search: localSearch });
      }
    }, 280);
    return () => clearTimeout(t);
  }, [localSearch, isComposing]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-3 border rounded-xl bg-white">
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-gray-500" />
        <input
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          placeholder="검색어를 입력하세요"
          className="flex-1 outline-none bg-transparent text-sm"
        />
      </div>
      {Array.isArray(availableTopics) && availableTopics.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2"></div>
      )}
    </div>
  );
}
