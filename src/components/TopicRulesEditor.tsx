import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, RefreshCcw, FlaskConical } from 'lucide-react';
import { db } from '../lib/db';
import { guessTopics, DEFAULT_TOPIC_RULES } from '../lib/classify';
import type { TopicRule } from '../lib/types';

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
  const [rules, setRules] = useState<TopicRule[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [testText, setTestText] = useState('');
  const [preview, setPreview] = useState<string[]>([]);

  useEffect(()=>{
    (async () => {
      const userRules = await db.topicRules.toArray();
      setRules(userRules);
    })();
  }, []);

  async function save(){
    await db.topicRules.bulkPut(rules);
    alert('규칙을 저장했어요.');
  }

  function addTopic(){
    const topicName = newTopic.trim();
    if (!topicName || rules.some(r => r.topic === topicName)) return;
    // GEMINI: 사용자가 토픽을 추가하면, 키워드는 비어있고 가중치는 3으로 설정합니다.
    const newRule: TopicRule = { topic: topicName, keywords: [], weight: 3 };
    setRules(prev => [...prev, newRule]);
    setNewTopic('');
  }

  function addKeyword(topicName: string, kwStr: string){
    const keywordsToAdd = kwStr.split(/[,;]/).map(s=>s.trim().toLowerCase()).filter(Boolean);
    setRules(prev => prev.map(rule => {
      if (rule.topic === topicName) {
        const newKeywords = Array.from(new Set([...rule.keywords, ...keywordsToAdd]));
        return { ...rule, keywords: newKeywords };
      }
      return rule;
    }));
  }

  function removeTopic(topicName: string){
    setRules(prev => prev.filter(r => r.topic !== topicName));
  }

  function removeKw(topicName: string, kw: string){
    setRules(prev => prev.map(rule => {
      if (rule.topic === topicName) {
        return { ...rule, keywords: rule.keywords.filter(k => k !== kw) };
      }
      return rule;
    }));
  }

  function resetToDefault(){
    if (!confirm('기본 추천 규칙으로 되돌릴까요? 현재 규칙은 덮어써집니다.')) return;
    const defaultRules: TopicRule[] = Object.entries(DEFAULT_TOPIC_RULES).map(([topic, keywordsWithWeights]) => ({
      topic,
      keywords: Object.keys(keywordsWithWeights),
      weight: 1, // 기본 규칙의 가중치는 1로 설정
    }));
    setRules(defaultRules);
  }

  // Test preview
  useEffect(()=>{
    const id = setTimeout(async () => {
      if (!testText.trim()) { setPreview([]); return; }
      try {
        // 임시 규칙을 DB에 저장하지 않고 테스트
        await db.transaction('r', db.topicRules, async () => {
          const p = await guessTopics(testText);
          setPreview(p.slice(0,5));
        });
      } catch (err) {
        console.error('Failed to guess topics:', err);
      }
    }, 200);
    return () => clearTimeout(id);
  }, [testText, rules]);

  const topics = useMemo(()=>rules.map(r => r.topic).sort(), [rules]);

  return (
    <div className="p-6 bg-white/60 backdrop-blur-lg rounded-2xl shadow-lg border border-white/20 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-lg">토픽 규칙</h3>
        <div className="flex items-center gap-2">
          <button onClick={resetToDefault} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300/50 bg-white/50 hover:bg-white/80 text-sm transition-colors">
            <RefreshCcw className="h-4 w-4" /> 기본값
          </button>
          <button onClick={save} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors">
            <Save className="h-4 w-4" /> 저장
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={newTopic}
          onChange={e=>setNewTopic(e.target.value)}
          placeholder="새 토픽 이름(예: Research)"
          className="flex-1 text-sm border border-gray-300/50 bg-white/50 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
        />
        <button onClick={addTopic} className="px-3 py-2 rounded-lg bg-teal-500 text-white hover:bg-teal-600 transition-colors">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {topics.length === 0 && (
        <div className="text-xs text-gray-500">아직 사용자 정의 규칙이 없어요. 기본값을 불러오거나 새 토픽을 추가하세요.</div>
      )}

      <div className="space-y-3">
        {rules.map(rule => (
          <div key={rule.topic} className="rounded-lg border p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">{rule.topic}</div>
              <button onClick={()=>removeTopic(rule.topic)} className="text-red-600 text-xs inline-flex items-center gap-1">
                <Trash2 className="h-3 w-3" /> 삭제
              </button>
            </div>
            <TopicKeywords values={rule.keywords||[]} onAdd={(s)=>addKeyword(rule.topic, s)} onRemove={(kw)=>removeKw(rule.topic, kw)} />
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white/60 border border-white/20 p-4 space-y-3">
        <div className="flex items-center gap-2 text-gray-700">
          <FlaskConical className="h-4 w-4" />
          <span className="text-sm font-medium">테스트</span>
        </div>
        <textarea value={testText} onChange={e=>setTestText(e.target.value)} placeholder="여기에 텍스트를 붙여넣으면 추론된 토픽을 미리봅니다."
          className="w-full min-h-[140px] border border-gray-300/50 bg-white/50 rounded-lg p-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors" />
        {!!preview.length && (
          <div className="flex flex-wrap gap-2">
            {preview.map(t => <Chip key={t}>{t}</Chip>)}
          </div>
        )}
      </div>
    </div>
  );
}

function TopicKeywords({ values, onAdd, onRemove }: { values: string[]; onAdd: (s: string) => void; onRemove: (kw: string) => void }) {
  const [v, setV] = useState('');
  function submit(){
    const s = v.trim();
    if (!s) return;
    onAdd(s);
    setV('');
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {values.map((kw) => <Chip key={kw} onRemove={()=>onRemove(kw)}>{kw}</Chip>)}
      </div>
      <div className="flex items-center gap-2">
        <input value={v} onChange={e=>setV(e.target.value)} placeholder="키워드 추가(쉼표로 여러 개)"
          className="flex-1 text-sm border border-gray-300/50 bg-white/50 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors" />
        <button onClick={submit} className="px-3 py-2 rounded-lg border border-gray-300/50 bg-white/50 hover:bg-white/80 text-sm transition-colors">추가</button>
      </div>
    </div>
  );
}
