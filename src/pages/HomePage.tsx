import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNotes } from '../lib/useNotes';
import NoteCard from '../components/NoteCard';
import FilterBar from '../components/FilterBar';
import { Plus, Settings } from 'lucide-react';

export default function HomePage() {
  const { notes, loading, filters, setFilters, toggleFavorite } = useNotes();
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);

  useEffect(() => {
    const topics = new Set<string>();
    notes.forEach(note => { (note.topics || []).forEach((t: string) => topics.add(t)); });
    setAvailableTopics(Array.from(topics).sort());
  }, [notes]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto mb-3"></div>
          <p className="text-gray-600">노트를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SelfDev Notes</h1>
              <p className="text-gray-600 text-sm">자기계발 요약 & 기록</p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/capture" className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                <Plus className="h-4 w-4" />
                새 노트
              </Link>
              <Link to="/settings" className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                <Settings className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <FilterBar filters={filters} onFiltersChange={setFilters} availableTopics={availableTopics} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-blue-600">{notes.length}</div>
            <div className="text-sm text-gray-600">전체 노트</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-red-600">{notes.filter(n => n.favorite).length}</div>
            <div className="text-sm text-gray-600">즐겨찾기</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-green-600">{availableTopics.length}</div>
            <div className="text-sm text-gray-600">주제</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-orange-600">
              {notes.reduce((acc, note) => acc + (note.todo || []).filter((t: any) => !t.done).length, 0)}
            </div>
            <div className="text-sm text-gray-600">할 일</div>
          </div>
        </div>

        {notes.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-400 mb-4">
              <Plus className="h-16 w-16 mx-auto mb-4 opacity-50" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">아직 노트가 없습니다</h3>
            <p className="text-gray-600 mb-6">Perplexity에서 요약한 내용을 붙여넣어 첫 번째 노트를 만들어보세요.</p>
            <Link to="/capture" className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
              <Plus className="h-5 w-5" />
              첫 노트 만들기
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {notes.map((note) => (
              <NoteCard key={note.id} note={note} onToggleFavorite={toggleFavorite} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
