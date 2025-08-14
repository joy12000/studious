import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useNotes } from '../lib/useNotes';

export default function NotePage(){
  const { id } = useParams();
  const { allNotes } = useNotes();
  const note = useMemo(()=> allNotes.find(n=>n.id===id), [id, allNotes]);

  if (!note) return <div className="text-center text-gray-500 py-10">노트를 찾을 수 없습니다. <Link className="text-blue-600 underline" to="/">홈으로</Link></div>;

  return (
    <article className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
      <h1 className="text-lg font-semibold">{note.title || '제목 없음'}</h1>
      <div className="text-xs text-gray-500">{new Date(note.createdAt).toLocaleString()}</div>
      <div className="flex flex-wrap gap-2">
        {note.topics.map(t => <span key={t} className="text-xs px-2 py-1 rounded-full bg-gray-100">#{t}</span>)}
      </div>
      <pre className="whitespace-pre-wrap text-sm text-gray-800">{note.content}</pre>
    </article>
  );
}
