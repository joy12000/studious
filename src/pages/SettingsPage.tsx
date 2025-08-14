import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { canInstall, onCanInstallChange, promptInstall } from '../lib/install';
import { useNotes } from '../lib/useNotes';

export default function SettingsPage() {
  const { notes } = useNotes();
  const [installable, setInstallable] = useState(canInstall());

  useEffect(() => {
    const off = onCanInstallChange(setInstallable);
    return off;
  }, []);

  function exportJson() {
    const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleInstall() {
    const ok = await promptInstall();
    if (!ok) alert('설치 가능 상태가 아니거나 취소됨');
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">설정</h1>

      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">앱 설치</div>
            <div className="text-sm text-gray-500">홈 화면(앱)으로 설치해서 더 편하게 사용하세요.</div>
          </div>
          <button
            disabled={!installable}
            onClick={handleInstall}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${installable ? 'bg-white text-blue-600 border-blue-600' : 'bg-gray-100 text-gray-400 border-gray-200'}`}
          >
            <Download className="w-4 h-4"/>설치하기
          </button>
        </div>
        {!installable && <p className="text-xs text-gray-500 mt-1">설치 가능 상태가 되면 버튼이 활성화됩니다.</p>}
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="font-semibold">데이터 백업</div>
        <div className="text-sm text-gray-500">현재 노트를 JSON으로 저장합니다.</div>
        <button onClick={exportJson} className="mt-2 px-3 py-2 rounded-lg border bg-white">JSON 내보내기</button>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="font-semibold">데이터 초기화</div>
        <div className="text-sm text-gray-500">모든 노트를 삭제합니다. 실행 전 백업을 권장합니다.</div>
        <button
          onClick={async () => {
            if (!confirm('정말 모든 노트를 삭제할까요?')) return;
            // 실제 구현에 맞는 전체 삭제 함수가 있다면 호출
            // 예: await db.notes.clear();
            indexedDB.deleteDatabase('selfdev-db');
            location.reload();
          }}
          className="mt-2 px-3 py-2 rounded-lg border bg-white text-red-600 border-red-300"
        >
          전체 삭제
        </button>
      </section>
    </div>
  );
}
