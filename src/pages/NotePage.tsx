import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useNotes } from '../lib/useNotes';
import { ArrowLeft, Trash2, Star } from 'lucide-react';

export default function NotePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notes, updateNote, deleteNote, toggleFavorite } = useNotes();
  const [note, setNote] = useState<any | null>(null);

  useEffect(() => {
    setNote(notes.find(n => n.id === id) || null);
  }, [notes, id]);

  if (!note) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        노트를 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/" className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-xl font-bold">{note.title || '제목 없음'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleFavorite(note.id)}
              className={`px-3 py-2 rounded border ${note.favorite ? 'text-yellow-700 border-yellow-300 bg-yellow-50' : 'text-gray-700 border-gray-200 bg-white'}`}
            >
              <Star className={note.favorite ? 'fill-yellow-400' : ''} />
            </button>
            <button
              onClick={async () => { if (confirm('이 노트를 정말 삭제하시겠습니까?')) { await deleteNote(note.id); navigate('/'); } }}
              className="px-3 py-2 rounded border text-red-600 border-red-300 bg-white"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {note.sourceUrl && (
            <a href={note.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm">
              원본 열기
            </a>
          )}
          <article className="prose max-w-none whitespace-pre-wrap mt-3 text-sm text-gray-800">
            {note.content}
          </article>
          {Array.isArray(note.topics) && note.topics.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {note.topics.map((t: string) => (<span key={t} className="bg-gray-100 border border-gray-200 rounded px-2 py-0.5 text-xs">{t}</span>))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
