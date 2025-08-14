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
    <Link to={`/note/${note.id}`} className="block border rounded-xl p-4 bg-white shadow-sm hover:bg-gray-50">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold">{note.title || '제목 없음'}</div>
          <div className="text-sm text-gray-600 whitespace-pre-wrap mt-1 line-clamp-4">{note.content}</div>
          {note.sourceUrl && (
            <button
              onClick={openSource}
              className="text-blue-600 hover:underline mt-2"
              title="원본 열기"
            >
              원본 열기
            </button>
          )}
        </div>
        {onToggleFavorite && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(note.id); }}
            className="text-yellow-500"
            title={note.favorite ? '즐겨찾기 해제' : '즐겨찾기'}
          >
            <Star className={note.favorite ? 'fill-yellow-400' : ''} />
          </button>
        )}
      </div>
      {Array.isArray(note.topics) && note.topics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {note.topics.map((t: string) => (
            <span key={t} className="bg-gray-100 border border-gray-200 rounded px-2 py-0.5 text-xs">{t}</span>
          ))}
        </div>
      )}
    </Link>
  );
}
