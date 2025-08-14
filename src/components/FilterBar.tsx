import React, { useMemo } from 'react';
import { Search, Calendar, Heart } from 'lucide-react';

interface FilterBarProps {
  filters: {
    search: string;
    topics: string[];
    dateRange: 'today' | '7days' | '30days' | 'all';
    favorite: boolean;
  };
  onFiltersChange: (filters: {
    search: string;
    topics: string[];
    dateRange: 'today' | '7days' | '30days' | 'all';
    favorite: boolean;
  }) => void;
  availableTopics: string[];
}

export default function FilterBar({ filters, onFiltersChange, availableTopics }: FilterBarProps) {
  const selectedTopics = useMemo(() => new Set(filters.topics), [filters.topics]);

  const setSearch = (v: string) => onFiltersChange({ ...filters, search: v });
  const setDateRange = (v: 'today' | '7days' | '30days' | 'all') => onFiltersChange({ ...filters, dateRange: v });
  const toggleFavorite = () => onFiltersChange({ ...filters, favorite: !filters.favorite });
  const toggleTopic = (topic: string) => {
    const next = new Set(selectedTopics);
    if (next.has(topic)) next.delete(topic);
    else next.add(topic);
    onFiltersChange({ ...filters, topics: Array.from(next) });
  };

  return (
    <div className="w-full space-y-3 p-3 bg-white border border-gray-200 rounded-xl">
      {/* Row 1: Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={filters.search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="검색어를 입력하세요"
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
          />
        </div>

        {/* Favorite toggle */}
        <button
          type="button"
          onClick={toggleFavorite}
          className={`flex items-center gap-1 px-3 py-2 border rounded-lg text-sm ${
            filters.favorite
              ? 'bg-rose-50 text-rose-600 border-rose-200'
              : 'bg-gray-50 text-gray-700 border-gray-200'
          }`}
          aria-pressed={filters.favorite}
          title="즐겨찾기만 보기"
        >
          <Heart className="h-4 w-4" />
          <span>즐겨찾기</span>
        </button>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <select
            value={filters.dateRange}
            onChange={(e) => setDateRange(e.target.value as FilterBarProps['filters']['dateRange'])}
            className="border rounded-lg px-2 py-2 text-sm bg-white"
          >
            <option value="today">오늘</option>
            <option value="7days">최근 7일</option>
            <option value="30days">최근 30일</option>
            <option value="all">전체</option>
          </select>
        </div>
      </div>

      {/* Row 2: Topics */}
      {availableTopics?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {availableTopics.map((topic) => {
            const active = selectedTopics.has(topic);
            return (
              <button
                key={topic}
                type="button"
                onClick={() => toggleTopic(topic)}
                className={`px-2 py-1 rounded-full text-xs border ${
                  active
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-gray-50 text-gray-700 border-gray-200'
                }`}
              >
                {topic}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}