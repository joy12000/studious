import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Home, Smartphone, RefreshCcw, Sun, Moon, Trash2, Menu } from 'lucide-react'; // GEMINI: Menu 아이콘 추가
import { canInstall, onCanInstallChange, promptInstall } from '../lib/install';
import { useNotes } from '../lib/useNotes';
import BackupPanel from '../components/BackupPanel';
import DataUsagePanel from '../components/DataUsagePanel';
import { useSidebar } from '../components/AppLayout'; // GEMINI: useSidebar 훅 임포트

import { db } from '../lib/db';
import type { AppSettings } from '../lib/types';
import { autoBackupIfNeeded } from '../lib/backup';
import VersionBadge from '../components/VersionBadge';
import { Button } from '@/components/ui/button'; // GEMINI: Button 임포트

type TabKey = 'general'|'backup'|'data'|'app';

function TabButton({active, onClick, children}:{active:boolean; onClick:()=>void; children:React.ReactNode}){
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm rounded-lg border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-card-foreground border hover:bg-muted'}`}
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
  const { setIsSidebarOpen } = useSidebar(); // GEMINI: useSidebar 훅 사용

  useEffect(()=>{ const off = onCanInstallChange(setInstallable); return off; }, []);
  useEffect(()=>{ (async ()=>{ const s = await db.settings.get('default'); setSettings(s || null); })(); }, []);
  useEffect(()=>{ autoBackupIfNeeded(); }, []);

  const noteCount = notes.length;
  const tagCount = useMemo(()=>{
    const all = new Set<string>();
    notes.forEach(n => {
      if (n.tag) all.add(n.tag);
    });
    return all.size;
  }, [notes]);

  async function toggleTheme(){
    if (!settings) return;
    const next = settings.theme === 'dark' ? 'light' : 'dark';
    const updated = { ...settings, theme: next };
    await db.settings.put({ id: 'default', ...updated });
    setSettings(updated);
    try {
      const root = document.documentElement;
      if (next === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
      localStorage.setItem('pref-theme', next);
    } catch {
      // localStorage or document might not be available in all environments
    }
  }

  async function wipeAll(){
    if (!confirm('앱의 모든 노트와 설정을 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없으니, 반드시 백업을 먼저 진행해주세요.')) return;
    indexedDB.deleteDatabase('selfdev-db');
    location.reload();
  }

  function goBack(){ history.back(); }
  function goHome(){ location.assign('/'); }

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            {/* 🚀 GEMINI: 메뉴 버튼 추가 */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden" // 데스크탑에서는 숨김
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">앱 설정</h1>
              <p className="text-sm text-muted-foreground">테마, 데이터 관리, 백업 등을 설정합니다.</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <TabButton active={tab==='general'} onClick={()=>setTab('general')}>일반</TabButton>
            <TabButton active={tab==='backup'} onClick={()=>setTab('backup')}>백업/복원</TabButton>
            <TabButton active={tab==='data'} onClick={()=>setTab('data')}>데이터 관리</TabButton>
            <TabButton active={tab==='app'} onClick={()=>setTab('app')}>앱 정보</TabButton>
          </div>

          {tab==='general' && (
            <div className="space-y-4">
              <section className="p-6 bg-card/60 backdrop-blur-lg rounded-2xl shadow-lg border border-card/20">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">화면 테마</div>
                    <div className="text-xs text-muted-foreground">현재 테마: {settings?.theme === 'dark' ? '다크' : '라이트'}</div>
                  </div>
                  <button onClick={toggleTheme} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-card/80 hover:bg-card transition-colors">
                    {settings?.theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    {settings?.theme === 'dark' ? '라이트 모드로' : '다크 모드로'}
                  </button>
                </div>
              </section>

              <section className="p-4 bg-card/60 backdrop-blur-lg rounded-2xl shadow-lg border border-card/20 grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-card/60">
                  <div className="text-xs text-muted-foreground">전체 노트 수</div>
                  <div className="text-xl font-semibold">{noteCount.toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-lg bg-card/60">
                  <div className="text-xs text-muted-foreground">전체 태그 수</div>
                  <div className="text-xl font-semibold">{tagCount.toLocaleString()}</div>
                </div>
              </section>
            </div>
          )}

          {tab==='backup' && (
            <div className="space-y-4">
              <BackupPanel />
            </div>
          )}

          {tab==='data' && (
            <div className="space-y-4">
              <DataUsagePanel />
            </div>
          )}

          {tab==='app' && (
            <div className="space-y-4">
              <section className="p-6 bg-card/60 backdrop-blur-lg rounded-2xl shadow-lg border border-card/20 space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-y-2 sm:gap-x-4">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">앱 설치</div>
                      <div className="text-xs text-muted-foreground">현재 기기에 앱을 설치하여 바로 사용하세요.</div>
                    </div>
                  </div>
                  <button
                    disabled={!installable}
                    onClick={promptInstall}
                    className={`px-3 py-1 sm:px-4 sm:py-2 rounded-lg text-sm font-semibold transition-colors w-full sm:w-auto ${installable ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
                  >
                    설치하기
                  </button>
                </div>
              </section>

              <section className="p-6 bg-card/60 backdrop-blur-lg rounded-2xl shadow-lg border border-card/20 space-y-3">
                <div className="flex items-center gap-3">
                  <RefreshCcw className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">앱 데이터 초기화</div>
                    <div className="text-xs text-muted-foreground">앱이 오작동하거나 느려졌을 때 사용하세요.</div>
                  </div>
                </div>
                <div>
                  <button
                    onClick={() => { if(confirm('앱의 캐시 데이터를 비우고 새로고침합니다. 계속할까요?')) { navigator.serviceWorker?.getRegistrations().then(rs => rs.forEach(r => r.unregister())); location.reload(); }}}
                    className="px-4 py-2 rounded-lg border bg-card/80 hover:bg-card text-sm transition-colors"
                  >
                    캐시 비우고 새로고침
                  </button>
                </div>
              </section>

              <section className="p-6 bg-destructive/10 backdrop-blur-lg rounded-2xl shadow-lg border border-destructive/20">
                <div className="flex items-center gap-3 text-destructive">
                  <Trash2 className="h-5 w-5" />
                  <div className="font-medium">모든 데이터 삭제</div>
                </div>
                <p className="text-xs text-destructive/80 mt-2">앱의 모든 노트와 설정을 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없으니, 반드시 백업을 먼저 진행해주세요.</p>
                <button onClick={wipeAll} className="mt-3 px-4 py-2 rounded-lg border bg-card/80 hover:bg-card text-destructive border-destructive/50 text-sm font-semibold transition-colors">
                  모든 데이터 영구 삭제
                </button>
              </section>

              <section className="text-xs text-muted-foreground px-1">
                <div>버전: <code>v{window.BUILD_VERSION || import.meta.env?.VITE_APP_VERSION || 'local'}</code></div>
                <VersionBadge />
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}