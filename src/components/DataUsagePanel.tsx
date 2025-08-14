import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../lib/db';
import { Trash2, Database } from 'lucide-react';

type Est = { usage: number; quota: number };
function toMB(n:number){ return (n/1024/1024).toFixed(2); }
function pct(usage:number, quota:number){ return quota ? Math.min(100, Math.round((usage/quota)*100)) : 0; }

export default function DataUsagePanel(){
  const [est, setEst] = useState<Est>({ usage: 0, quota: 0 });
  const [noteBytes, setNoteBytes] = useState(0);
  const [counts, setCounts] = useState({ notes: 0, settings: 0 });

  useEffect(()=>{
    (async () => {
      try {
        const e = await (navigator as any).storage?.estimate?.() || {};
        setEst({ usage: e.usage || 0, quota: e.quota || 0 });
      } catch {}
      try {
        const notes = await db.notes.toArray();
        setCounts({ notes: notes.length, settings: await db.settings.count() });
        const total = notes.reduce((sum, n) => {
          try { return sum + new Blob([JSON.stringify(n)]).size; } catch { return sum + (n?.content?.length||0); }
        }, 0);
        setNoteBytes(total);
      } catch {}
    })();
  }, []);

  async function purgeEmpty(){
    const notes = await db.notes.toArray();
    const empties = notes.filter(n => !String(n?.content||'').trim());
    if (!empties.length) { alert('삭제할 빈 노트가 없습니다.'); return; }
    if (!confirm(`빈 노트 ${empties.length}개를 삭제할까요?`)) return;
    await db.transaction('rw', db.notes, async () => {
      for (const n of empties) await db.notes.delete(n.id as any);
    });
    location.reload();
  }

  const percent = useMemo(()=>pct(est.usage, est.quota), [est]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-gray-500" />
        <h3 className="font-medium">데이터 사용량</h3>
      </div>

      <div className="w-full h-2 bg-gray-100 rounded">
        <div className="h-2 bg-blue-500 rounded" style={{ width: `${percent}%` }} />
      </div>
      <div className="text-xs text-gray-600">
        브라우저 저장소 사용량: <b>{toMB(est.usage)}MB</b> / {toMB(est.quota)}MB ({percent}%)
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="p-3 rounded-lg border">
          <div className="text-xs text-gray-500">노트 개수</div>
          <div className="text-lg font-semibold">{counts.notes.toLocaleString()}</div>
        </div>
        <div className="p-3 rounded-lg border">
          <div className="text-xs text-gray-500">노트 데이터</div>
          <div className="text-lg font-semibold">{toMB(noteBytes)}MB</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">빈 노트 정리로 약간의 공간을 확보할 수 있습니다.</div>
        <button onClick={purgeEmpty} className="inline-flex items-center gap-2 px-3 py-2 rounded border text-sm">
          <Trash2 className="h-4 w-4" /> 빈 노트 삭제
        </button>
      </div>
    </div>
  );
}