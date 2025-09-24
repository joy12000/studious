// src/pages/SettingsPage.tsx

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Home, Smartphone, RefreshCcw, Sun, Moon, Trash2, Menu, Plus, Edit, Trash } from 'lucide-react';
import { canInstall, onCanInstallChange, promptInstall } from '../lib/install';
import { useNotes } from '../lib/useNotes';
import BackupPanel from '../components/BackupPanel';
import DataUsagePanel from '../components/DataUsagePanel';
import { useSidebar } from '../components/AppLayout';
import { db } from '../lib/db';
import type { AppSettings, Subject } from '../lib/types';
import { autoBackupIfNeeded } from '../lib/backup';
import VersionBadge from '../components/VersionBadge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns'; // ✨ date-fns 임포트

type TabKey = 'general'|'subjects'|'backup'|'data'|'app';

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

const SubjectsPanel = () => {
  const { allSubjects, addSubject, updateSubject, deleteSubject, updateSubjectAndSchedule } = useNotes();

  const handleAddSubject = async () => {
    const name = prompt('새 과목 이름을 입력하세요.');
    if (name) {
      await addSubject(name);
    }
  };

  const handleEditSubject = async (subject: Subject) => {
    const associatedSchedules = await db.schedule.where('subjectId').equals(subject.id).toArray();

    if (associatedSchedules.length === 1) {
      const schedule = associatedSchedules[0];
      const newName = prompt('새 과목 이름을 입력하세요.', subject.name);
      if (!newName) return;

      const newStartTime = prompt('새 시작 시간을 입력하세요 (HH:MM).', schedule.startTime);
      if (!newStartTime) return;

      const newEndTime = prompt('새 종료 시간을 입력하세요 (HH:MM).', schedule.endTime);
      if (!newEndTime) return;

      const newDayOfWeek = prompt('새 요일을 입력하세요 (월, 화, 수, 목, 금, 토, 일).', schedule.dayOfWeek);
      if (!newDayOfWeek) return;

      await updateSubjectAndSchedule(subject.id, schedule.id, newName, newStartTime, newEndTime, newDayOfWeek);

    } else {
      const newName = prompt('새 과목 이름을 입력하세요.', subject.name);
      if (newName && newName !== subject.name) {
        await updateSubject(subject.id, newName, subject.color);
      }
      if (associatedSchedules.length > 1) {
        alert('이 과목에는 여러 시간표가 연결되어 있습니다. 과목 이름만 변경되었습니다. 상세 시간표 수정은 시간표 페이지에서 진행해주세요.');
      } else {
        alert('이 과목은 시간표에 등록되지 않았습니다. 과목 이름만 변경되었습니다.');
      }
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (confirm('정말로 이 과목을 삭제하시겠습니까?')) {
      await deleteSubject(id);
    }
  };

  return (
    <section className="p-6 bg-card/60 backdrop-blur-lg rounded-2xl shadow-lg border border-card/20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">과목 관리</h2>
        <Button onClick={handleAddSubject} size="sm"><Plus className="mr-2 h-4 w-4"/>과목 추가</Button>
      </div>
      <div className="space-y-2">
        {allSubjects?.map(subject => (
          <div key={subject.id} className="flex items-center justify-between p-2 rounded-lg bg-card">
            <span>{subject.name}</span>
            <div className="space-x-2">
              <Button onClick={() => handleEditSubject(subject)} variant="ghost" size="icon"><Edit className="h-4 w-4"/></Button>
              <Button onClick={() => handleDeleteSubject(subject.id)} variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash className="h-4 w-4"/></Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}


export default function SettingsPage(){
  const { notes, allSubjects } = useNotes();
  const [tab, setTab] = useState<TabKey>('general');
  const [installable, setInstallable] = useState(canInstall());
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const { setIsSidebarOpen } = useSidebar();

  useEffect(()=>{ const off = onCanInstallChange(setInstallable); return off; }, []);
  useEffect(()=>{ (async ()=>{ const s = await db.settings.get('default'); setSettings(s || null); })(); }, []);
  useEffect(()=>{ autoBackupIfNeeded(); }, []);

  const noteCount = notes.length;
  const subjectCount = allSubjects?.length || 0;

  async function updateSettings(newSettings: Partial<AppSettings>) {
    const currentSettings = await db.settings.get('default') || { id: 'default' };
    const updated = { ...currentSettings, ...newSettings };
    await db.settings.put(updated as AppSettings & { id: string });
    setSettings(updated);
  }

  async function toggleTheme(){
    if (!settings) return;
    const next = settings.theme === 'dark' ? 'light' : 'dark';
    updateSettings({ theme: next });
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
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b p-4 pt-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">앱 설정</h1>
              <p className="text-sm text-muted-foreground">테마, 데이터 관리, 백업 등을 설정합니다.</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <TabButton active={tab==='general'} onClick={()=>setTab('general')}>일반</TabButton>
            <TabButton active={tab==='subjects'} onClick={()=>setTab('subjects')}>과목 관리</TabButton>
            <TabButton active={tab==='backup'} onClick={()=>setTab('backup')}>백업/복원</TabButton>
            <TabButton active={tab==='data'} onClick={()=>setTab('data')}>데이터 관리</TabButton>
            <TabButton active={tab==='app'} onClick={()=>setTab('app')}>앱 정보</TabButton>
          </div>

          {tab==='general' && (
            <div className="space-y-4">
              <section className="p-6 bg-card/60 rounded-2xl shadow-lg border">
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

              {/* ✨ [추가] 학기 시작일 설정 UI */}
              <section className="p-6 bg-card/60 rounded-2xl shadow-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">학기 시작일 설정</div>
                    <div className="text-xs text-muted-foreground">AI 참고서 생성 시 주차 계산의 기준이 됩니다.</div>
                  </div>
                  <input
                    type="date"
                    value={settings?.semesterStartDate || ''}
                    onChange={(e) => updateSettings({ semesterStartDate: e.target.value })}
                    className="px-3 py-2 rounded-lg border bg-card/80"
                  />
                </div>
              </section>

              <section className="p-4 bg-card/60 rounded-2xl shadow-lg border grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-card/60">
                  <div className="text-xs text-muted-foreground">전체 노트 수</div>
                  <div className="text-xl font-semibold">{noteCount.toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-lg bg-card/60">
                  <div className="text-xs text-muted-foreground">전체 과목 수</div>
                  <div className="text-xl font-semibold">{subjectCount.toLocaleString()}</div>
                </div>
              </section>
            </div>
          )}

          {tab==='subjects' && <SubjectsPanel />}

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
