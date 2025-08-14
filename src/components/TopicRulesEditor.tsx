import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, RefreshCcw, FlaskConical } from 'lucide-react';
import { db } from '../lib/db';
import { guessTopics } from '../lib/classify';

type Rules = Record<string, string[]>;

const DEFAULTS_FALLBACK: Rules = {
  Productivity: ['todo','task','schedule','routine','workflow','focus','deep work','pomodoro','habit'],
  Learning: ['study','learn','course','lecture','note-taking','flashcard',' spaced','anki','memory'],
  Mindset: ['mindset','motivation','discipline','reflection','journal','grit','growth'],
  Health: ['workout','fitness','sleep','diet','nutrition','meditation','yoga','steps'],
  Career: ['career','job','interview','portfolio','resume','networking','leadership'],
};

function Chip({children, onRemove}:{children:React.ReactNode; onRemove?:()=>void}){
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-gray-200 bg-gray-50">
      {children}
      {onRemove && (
        <button className="ml-1 rounded hover:bg-gray-200 px-1" onClick={onRemove} aria-label="삭제">×</button>
      )}
    </span>
  );
}

export default function TopicRulesEditor(){
  const [rules, setRules] = useState<Rules>({});
  const [newTopic, setNewTopic] = useState('');
  const [testText, setTestText] = useState('');
  const [preview, setPreview] = useState<string[]>([]);

  useEffect(()=>{
    (async () => {
      const s = await db.settings.get('default');
      setRules({ ...(s?.topicRules || {}) });
    })();
  }, []);

  async function save(){
    const s = await db.settings.get('default');
    await db.settings.put({ id: 'default', ...(s||{}), topicRules: rules } as any);
    alert('규칙을 저장했어요.');
  }

  function addTopic(){
    const t = newTopic.trim();
    if (!t || rules[t]) return;
    setRules(prev => ({ ...prev, [t]: [] }));
    setNewTopic('');
  }

  function addKeyword(topic: string, kwStr: string){
    const kws = kwStr.split(/[,;]/).map(s=>s.trim()).filter(Boolean);
    setRules(prev => {
      const cur = new Set([...(prev[topic]||[])]);
      kws.forEach(k => cur.add(k));
      return { ...prev, [topic]: Array.from(cur) };
    });
  }

  function removeTopic(topic: string){
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [topic]:_, ...rest } = rules;
    setRules(rest);
  }

  function removeKw(topic: string, kw: string){
    setRules(prev => ({ ...prev, [topic]: (prev[topic]||[]).filter(k => k !== kw) }));
  }

  function resetToDefault(){
    if (!confirm('기본 추천 규칙으로 되돌릴까요? 현재 규칙은 덮어써집니다.')) return;
    setRules({ ...DEFAULTS_FALLBACK });
  }

  // Test preview
  useEffect(()=>{
    const id = setTimeout(async () => {
      if (!testText.trim()) { setPreview([]); return; }
      try {
        const p = await guessTopics(testText);
        setPreview(p.slice(0,5));
      } catch {}
    }, 200);
    return () => clearTimeout(id);
  }, [testText]);

  const topics = useMemo(()=>Object.keys(rules).sort(), [rules]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">토픽 규칙</h3>
        <div className="flex items-center gap-2">
          <button onClick={resetToDefault} className="inline-flex items-center gap-2 px-3 py-2 rounded border text-sm">
            <RefreshCcw className="h-4 w-4" /> 기본값
          </button>
          <button onClick={save} className="inline-flex items-center gap-2 px-3 py-2 rounded bg-blue-600 text-white text-sm">
            <Save className="h-4 w-4" /> 저장
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={newTopic}
          onChange={e=>setNewTopic(e.target.value)}
          placeholder="새 토픽 이름(예: Research)"
          className="flex-1 text-sm border rounded px-2 py-2"
        />
        <button onClick={addTopic} className="px-3 py-2 rounded bg-emerald-600 text-white text-sm">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {topics.length === 0 && (
        <div className="text-xs text-gray-500">아직 사용자 정의 규칙이 없어요. 기본값을 불러오거나 새 토픽을 추가하세요.</div>
      )}

      <div className="space-y-3">
        {topics.map(t => (
          <div key={t} className="rounded-lg border p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">{t}</div>
              <button onClick={()=>removeTopic(t)} className="text-red-600 text-xs inline-flex items-center gap-1">
                <Trash2 className="h-3 w-3" /> 삭제
              </button>
            </div>
            <TopicKeywords topic={t} values={rules[t]||[]} onAdd={(s)=>addKeyword(t, s)} onRemove={(kw)=>removeKw(t, kw)} />
          </div>
        ))}
      </div>

      <div className="rounded-xl border p-3 space-y-2 bg-gray-50">
        <div className="flex items-center gap-2 text-gray-700">
          <FlaskConical className="h-4 w-4" />
          <span className="text-sm font-medium">테스트</span>
        </div>
        <textarea value={testText} onChange={e=>setTestText(e.target.value)} placeholder="여기에 텍스트를 붙여넣으면 추론된 토픽을 미리봅니다."
          className="w-full min-h-[140px] border rounded p-2" />
        {!!preview.length && (
          <div className="flex flex-wrap gap-2">
            {preview.map(t => <Chip key={t}>{t}</Chip>)}
          </div>
        )}
      </div>
    </div>
  );
}

function TopicKeywords({topic, values, onAdd, onRemove}:{topic:string; values:string[]; onAdd:(s:string)=>void; onRemove:(kw:string)=>void}){
  const [v, setV] = useState('');
  function submit(){
    const s = v.trim();
    if (!s) return;
    onAdd(s);
    setV('');
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {values.map((kw) => <Chip key={kw} onRemove={()=>onRemove(kw)}>{kw}</Chip>)}
      </div>
      <div className="flex items-center gap-2">
        <input value={v} onChange={e=>setV(e.target.value)} placeholder="키워드 추가(쉼표로 여러 개)"
          className="flex-1 text-sm border rounded px-2 py-2" />
        <button onClick={submit} className="px-3 py-2 rounded border text-sm">추가</button>
      </div>
    </div>
  );
}

function Chip({children, onRemove}:{children:React.ReactNode; onRemove?:()=>void}){
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-gray-200 bg-gray-50">
      {children}
      {onRemove && (
        <button className="ml-1 rounded hover:bg-gray-200 px-1" onClick={onRemove} aria-label="삭제">×</button>
      )}
    </span>
  );
}