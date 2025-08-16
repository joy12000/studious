import React from 'react';
import { Star } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NoteCard({ note, onToggleFavorite }: {note:any; onToggleFavorite?:(id:any)=>void;}) {
  const openSource = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!note.sourceUrl) return;
    const url: string = note.sourceUrl;
    const vidMatch = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
    const vid = vidMatch ? vidMatch[1] : null;
    const deep = vid ? `vnd.youtube://watch?v=${vid}` : url;
    const fallback = () => window.open(url, '_blank');
    let used = false;
    const t = setTimeout(() => { if (!used) fallback(); }, 350);
    try { (window as any).location.href = deep; used = true; } catch {}
    setTimeout(()=>clearTimeout(t), 2000);
  };

  return (
    <Link to={`/note/${note.id}`} className="block bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow duration-300">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-lg text-gray-900 line-clamp-2">{note.title || '제목 없음'}</div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap mt-2 line-clamp-3">{note.content}</div>
          {note.sourceUrl && (
            <button
              onClick={openSource}
              className="text-teal-600 hover:text-teal-700 text-sm font-medium mt-4"
              title="원본 열기"
            >
              원본 열기
            </button>
          )}
        </div>
        {onToggleFavorite && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(note.id); }}
            className="text-gray-300 hover:text-yellow-400 transition-colors"
            title={note.favorite ? '즐겨찾기 해제' : '즐겨찾기'}
          >
            <Star className={`w-6 h-6 ${note.favorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
          </button>
        )}
      </div>
      {Array.isArray(note.topics) && note.topics.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {note.topics.map((t: string) => (
            <div key={t} className="bg-gray-100 text-gray-600 rounded-full px-3 py-1 text-xs font-medium">{t}</div>
          ))}
        </div>
      )}
    </Link>
  );
}
