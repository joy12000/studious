import React from 'react';
import { Link } from 'react-router-dom';
import { Note } from '../lib/types';
import TopicBadge from './TopicBadge';
import { Calendar, ExternalLink, Heart, Star } from 'lucide-react';

interface NoteCardProps {
  note: Note;
  onToggleFavorite: (id: string) => void;
}

export default function NoteCard({ note, onToggleFavorite }: NoteCardProps) {
  const openSource = () => {
    if (!note.sourceUrl) return;
    const url = note.sourceUrl;
    const vidMatch = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
    const vid = vidMatch ? vidMatch[1] : null;
    const deep = vid ? `vnd.youtube://watch?v=${vid}` : url;
    const fallback = () => window.open(url, '_blank');
    let used = false;
    const t = setTimeout(() => { if (!used) fallback(); }, 350);
    try { (window as any).location.href = deep; used = true; } catch {}
    setTimeout(()=>clearTimeout(t), 2000);
  };
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) return '방금 전';
    if (diffInHours < 24) return `${Math.floor(diffInHours)}시간 전`;
    if (diffInHours < 24 * 7) return `${Math.floor(diffInHours / 24)}일 전`;
    
    return date.toLocaleDateString('ko-KR', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const getPreview = (content: string) => {
    return content.length > 200 ? content.slice(0, 200) + '...' : content;
  };

  const getSourceIcon = (sourceType: Note['sourceType']) => {
    switch (sourceType) {
      case 'youtube':
        return '🎬';
      case 'book':
        return '📖';
      case 'web':
        return '🌐';
      default:
        return '📝';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:border-gray-200 transition-all duration-200 group">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <Link to={`/note/${note.id}`} className="block">
            <h3 className="font-semibold text-gray-900 text-lg mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
              {getSourceIcon(note.sourceType)} {note.title}
            </h3>
          </Link>
          
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(note.createdAt)}</span>
            {note.sourceUrl && (
              <>
                <span>•</span>
                <a 
                  href={note.sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-blue-600 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3" />
                  원문 보기
                </a>
              </>
            )}
          </div>
        </div>
        
        <button
          onClick={(e) => {
            e.preventDefault();
            onToggleFavorite(note.id);
          }}
          className={`p-2 rounded-full transition-all duration-200 ${
            note.favorite 
              ? 'text-red-500 hover:bg-red-50' 
              : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
          }`}
        >
          {note.favorite ? <Heart className="h-5 w-5 fill-current" /> : <Heart className="h-5 w-5" />}
        </button>
      </div>

      {/* Content Preview */}
      <Link to={`/note/${note.id}`} className="block">
        <p className="text-gray-700 mb-4 line-clamp-3">
          {getPreview(note.content)}
        </p>
      </Link>

      {/* Topics */}
      <div className="flex flex-wrap gap-2 mb-4">
        {note.topics.map((topic) => (
          <TopicBadge key={topic} topic={topic} variant="small" />
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-50">
        <div className="flex items-center gap-4 text-sm text-gray-500">
          {note.highlights.length > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4" />
              {note.highlights.length}개 하이라이트
            </span>
          )}
          {note.todo.length > 0 && (
            <span className="flex items-center gap-1">
              ✅ {note.todo.filter(t => !t.done).length}/{note.todo.length} 할 일
            </span>
          )}
        </div>
        
        {note.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {note.labels.slice(0, 2).map((label) => (
              <span
                key={label}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full"
              >
                #{label}
              </span>
            ))}
            {note.labels.length > 2 && (
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                +{note.labels.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}