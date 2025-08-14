import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotes } from '../lib/useNotes';
import FilterBar from '../components/FilterBar';
import { Star, Plus } from 'lucide-react';

export default function HomePage(){
  const { notes, allNotes, filters, setFilters, toggleFavorite } = useNotes();
  const [topics, setTopics] = useState<string[]>([]);

  useEffect(()=>{
    const set = new Set<string>();
    allNotes.forEach(n => n.topics.forEach(t => set.add(t)));
    setTopics(Array.from(set).sort());
  }, [allNotes]);

  return (
    <div className="space-y-4">
      <FilterBar topics={topics} value={filters} onChange={setFilters} />

      <div className="flex justify-end">
        <Link to="/capture" className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded bg-blue-600 text-white">
          <Plus className="h-4 w-4" /> 새 노트
        </Link>
      </div>

      <ul className="space-y-3">
        {notes.map(n => (
          <li key={n.id} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex justify-between items-start">
              <Link to={`/note/${n.id}`} className="font-medium">{n.title || '제목 없음'}</Link>
              <button onClick={()=>toggleFavorite(n.id)} className="text-yellow-500">
                <Star className="h-4 w-4" fill={n.favorite ? 'currentColor' : 'none'} />
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {new Date(n.createdAt).toLocaleString()}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {n.topics.map(t => <span key={t} className="text-xs px-2 py-1 rounded-full bg-gray-100">#{t}</span>)}
            </div>
            <p className="text-sm text-gray-700 mt-2 line-clamp-2">{n.content}</p>
          </li>
        ))}
        {notes.length===0 && (
          <li className="text-center text-gray-500 py-10">노트가 없습니다. 우측 상단의 “새 노트”를 눌러 추가해보세요.</li>
        )}
      </ul>
    </div>
  );
}
