// src/pages/SettingsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Home, Smartphone, RefreshCcw, Sun, Moon, Trash2 } from 'lucide-react';
import { canInstall, onCanInstallChange, promptInstall } from '../lib/install';
import { useNotes } from '../lib/useNotes';
import BackupPanel from '../components/BackupPanel';
import DataUsagePanel from '../components/DataUsagePanel';
import TopicRulesEditor from '../components/TopicRulesEditor';
import { db } from '../lib/db';
import type { AppSettings } from '../lib/types';
import { autoBackupIfNeeded } from '../lib/backup';

type TabKey = 'general'|'backup'|'data'|'topics'|'app';

function TabButton({active, onClick, children}:{active:boolean; onClick:()=>void; children:React.ReactNode}){
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm rounded-lg border ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
    >
      {children}
    </button>
  );
}

export default function SettingsPage(){
  const { notes } = useNotes();
  const [tab, setTab] = useState<TabKey>('general');
  const [installable, setInstallable] = useState(canInstall());
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(()=>{ const off = onCanInstallChange(setInstallable); return off; }, []);
  useEffect(()=>{ (async ()=>{ const s = await db.settings.get('default'); setSettings(s || null); })(); }, []);
  useEffect(()=>{ autoBackupIfNeeded(); }, []);

  const noteCount = notes.length;
  const topicCount = useMemo(()=>{
    const all = new Set<string>();
    notes.forEach(n => (n.topics||[]).forEach(t => all.add(t)));
    return all.size;
  }, [notes]);

  async function toggleTheme(){
    if (!settings) return;
    const next = settings.theme === 'dark' ? 'light' : 'dark';
    const updated = { ...settings, theme: next };
    await db.settings.put({ id: 'default', ...updated } as any);
    setSettings(updated);
    try {
      const root = document.documentElement;
      if (next === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
      localStorage.setItem('pref-theme', next);
    } catch {}
  }

  async function wipeAll(){
    if (!confirm('정말 모든 노트와 설정을 삭제할까요? 이 작업은 되돌릴 수 없습니다.')) return;
    indexedDB.deleteDatabase('selfdev-db');
    location.reload();
  }

  // Back buttons (no Router dependency)
  function goBack(){ history.back(); }
  function goHome(){ location.assign('/'); }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
            <header className="sticky top-0 z-10 bg-gray-50/80 backdrop-blur-lg border-b border-gray-200/80 px-4 py-3">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-y-3">
          <div className="flex items-center gap-4">
            <button onClick={goBack} className="p-2 rounded-lg border bg-white/80 hover:bg-white transition-colors" title="뒤로가기">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">설정</h1>
              <p className="text-sm text-gray-500">백업/복원, 데이터, 분류 규칙, PWA 설치</p>
            </div>
          </div>
          <button onClick={goHome} className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 transition-colors" title="홈으로">
            <Home className="h-4 w-4" /> 홈으로
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <TabButton active={tab==='general'} onClick={()=>setTab('general')}>일반</TabButton>
        <TabButton active={tab==='backup'} onClick={()=>setTab('backup')}>백업</TabButton>
        <TabButton active={tab==='data'} onClick={()=>setTab('data')}>데이터</TabButton>
        <TabButton active={tab==='topics'} onClick={()=>setTab('topics')}>분류 규칙</TabButton>
        <TabButton active={tab==='app'} onClick={()=>setTab('app')}>앱</TabButton>
      </div>

      {tab==='general' && (
        <div className="space-y-4">
          <section className="p-6 bg-white/60 backdrop-blur-lg rounded-2xl shadow-lg border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">테마</div>
                <div className="text-xs text-gray-500">현재: {settings?.theme || 'light'}</div>
              </div>
              <button onClick={toggleTheme} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white/80 hover:bg-white transition-colors">
                {settings?.theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {settings?.theme === 'dark' ? '라이트로 전환' : '다크로 전환'}
              </button>
            </div>
          </section>

          <section className="p-4 bg-white/60 backdrop-blur-lg rounded-2xl shadow-lg border border-white/20 grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-white/60">
              <div className="text-xs text-gray-500">전체 노트</div>
              <div className="text-xl font-semibold">{noteCount.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-lg bg-white/60">
              <div className="text-xs text-gray-500">주제 수</div>
              <div className="text-xl font-semibold">{topicCount.toLocaleString()}</div>
            </div>
          </section>
        </div>
      )}

      {tab==='backup' && (
        <div className="space-y-4">
          <BackupPanel />
          <div className="text-xs text-gray-500">
            자동 백업은 앱을 열었을 때 최근 백업이 7일 이상 지났다면 JSON을 다운로드합니다.
          </div>
        </div>
      )}

      {tab==='data' && (
        <div className="space-y-4">
          <DataUsagePanel />
        </div>
      )}

      {tab==='topics' && (
        <div className="space-y-4">
          <TopicRulesEditor />
        </div>
      )}

      {tab==='app' && (
        <div className="space-y-4">
          <section className="p-6 bg-white/60 backdrop-blur-lg rounded-2xl shadow-lg border border-white/20 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-y-2 sm:gap-x-4">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-gray-600" />
                <div>
                  <div className="font-medium">PWA 설치</div>
                  <div className="text-xs text-gray-500">홈화면에 앱처럼 설치합니다.</div>
                </div>
              </div>
              <button
                disabled={!installable}
                onClick={promptInstall}
                className={`px-3 py-1 sm:px-4 sm:py-2 rounded-lg text-sm font-semibold transition-colors w-full sm:w-auto ${installable ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
              >
                설치하기
              </button>
            </div>
          </section>

          <section className="p-6 bg-white/60 backdrop-blur-lg rounded-2xl shadow-lg border border-white/20 space-y-3">
            <div className="flex items-center gap-3">
              <RefreshCcw className="h-5 w-5 text-gray-600" />
              <div>
                <div className="font-medium">캐시 초기화</div>
                <div className="text-xs text-gray-500">서비스워커/캐시 꼬임 시 강제 새로고침</div>
              </div>
            </div>
            <div>
              <button
                onClick={() => { navigator.serviceWorker?.getRegistrations().then(rs => rs.forEach(r => r.unregister())); location.reload(); }}
                className="px-4 py-2 rounded-lg border bg-white/80 hover:bg-white text-sm transition-colors"
              >
                캐시 비우고 새로고침
              </button>
            </div>
          </section>

          <section className="p-6 bg-red-500/10 backdrop-blur-lg rounded-2xl shadow-lg border border-red-500/20">
            <div className="flex items-center gap-3 text-red-700">
              <Trash2 className="h-5 w-5" />
              <div className="font-medium">위험 구역</div>
            </div>
            <p className="text-xs text-red-700/80 mt-2">모든 데이터를 완전히 삭제합니다. 백업 후 진행하세요.</p>
            <button onClick={wipeAll} className="mt-3 px-4 py-2 rounded-lg border bg-white/80 hover:bg-white text-red-600 border-red-300/50 text-sm font-semibold transition-colors">
              전체 삭제
            </button>
          </section>

          <section className="text-xs text-gray-400 px-1">
            <div>버전: <code>v{(window as any).BUILD_VERSION || (import.meta as any).env?.VITE_APP_VERSION || 'local'}</code></div>
          </section>
        </div>
      )}
    </div>
  );
}