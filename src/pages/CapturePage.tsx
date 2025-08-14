import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotes } from '../lib/useNotes';
import { guessTopics } from '../lib/classify';
import { Save, ArrowLeft, Sparkles } from 'lucide-react';

export default function CapturePage(){
  const { addNote } = useNotes();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [topics, setTopics] = useState<string[]>([]);

  useEffect(()=>{
    let alive = true;
    async function run(){
      const g = await guessTopics(content);
      if (alive) setTopics(g);
    }
    run();
    return ()=>{ alive = false; };
  }, [content]);

  async function onSave(){
    const id = await addNote(content);
    navigate(`/note/${id}`);
  }

  return (
    <div className="space-y-4">
      <button onClick={()=>navigate(-1)} className="text-sm text-gray-600 inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> 뒤로</button>
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <textarea
          value={content}
          onChange={e=>setContent(e.target.value)}
          placeholder="여기에 내용을 붙여넣거나 입력하세요…"
          className="w-full min-h-[200px] outline-none"
        />
      </div>
      <div className="text-sm text-gray-600">예상 주제: {topics.length ? topics.map(t=>`#${t}`).join(' ') : '없음'}</div>
      <div className="flex gap-2">
        <button onClick={onSave} className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded bg-blue-600 text-white">
          <Save className="h-4 w-4" /> 저장
        </button>
        <button onClick={()=>setContent(c=>c.trim())} className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded bg-gray-100">
          <Sparkles className="h-4 w-4" /> 트림
        </button>
      </div>
    </div>
  );
}
