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
        const e: StorageEstimate = await navigator.storage?.estimate?.() || { usage: 0, quota: 0 };
        setEst({ usage: e.usage || 0, quota: e.quota || 0 });
      } catch (err) {
        console.error('Failed to estimate storage:', err);
      }
      try {
        const notes = await db.notes.toArray();
        setCounts({ notes: notes.length, settings: await db.settings.count() });
        const total = notes.reduce((sum, n) => {
          try { return sum + new Blob([JSON.stringify(n)]).size; } catch { return sum + (n?.content?.length||0); }
        }, 0);
        setNoteBytes(total);
      } catch (err) {
        console.error('Failed to calculate note size:', err);
      }
    })();
  }, []);

  async function deduplicateNotesByUrl(){
    const notes = await db.notes.toArray();
    const notesWithUrl = notes.filter(n => n.sourceUrl);

    const notesByUrl = new Map<string, any[]>();
    for (const note of notesWithUrl) {
      if (!notesByUrl.has(note.sourceUrl!)) {
        notesByUrl.set(note.sourceUrl!, []);
      }
      notesByUrl.get(note.sourceUrl!)!.push(note);
    }

    const duplicatesToDelete: any[] = [];
    for (const [url, groupedNotes] of notesByUrl.entries()) {
      if (groupedNotes.length > 1) {
        groupedNotes.sort((a, b) => b.updatedAt - a.updatedAt);
        duplicatesToDelete.push(...groupedNotes.slice(1));
      }
    }

    if (!duplicatesToDelete.length) {
      alert('삭제할 중복 노트가 없습니다.');
      return;
    }

    if (!confirm(`중복된 노트 ${duplicatesToDelete.length}개를 삭제할까요? 가장 최근에 업데이트된 노트만 남깁니다.`)) return;

    await db.notes.bulkDelete(duplicatesToDelete.map(n => n.id));
    location.reload();
  }

  const percent = useMemo(()=>pct(est.usage, est.quota), [est]);

  return (
    <div className="p-6 bg-card/60 backdrop-blur-lg rounded-2xl shadow-lg border border-card/20 space-y-4">
      <div className="flex items-center gap-3">
        <Database className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-medium">데이터 사용량</h3>
      </div>

      <div className="w-full h-2.5 bg-muted/70 rounded-full">
        <div className="h-2.5 bg-primary rounded-full" style={{ width: `${percent}%` }} />
      </div>
      <div className="text-xs text-muted-foreground">
        브라우저 저장소 사용량: <b>{toMB(est.usage)}MB</b> / {toMB(est.quota)}MB ({percent}%)
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="p-4 rounded-lg bg-card/60">
          <div className="text-xs text-muted-foreground">노트 개수</div>
          <div className="text-xl font-semibold">{counts.notes.toLocaleString()}</div>
        </div>
        <div className="p-4 rounded-lg bg-card/60">
          <div className="text-xs text-muted-foreground">노트 데이터</div>
          <div className="text-xl font-semibold">{toMB(noteBytes)}MB</div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-muted-foreground/90">유튜브 링크가 동일한 노트 중 가장 최신 버전을 남기고 정리합니다.</div>
        <button onClick={deduplicateNotesByUrl} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-card/50 hover:bg-card/80 text-sm transition-colors">
          <Trash2 className="h-4 w-4" /> 중복 노트 삭제
        </button>
      </div>
    </div>
  );
}