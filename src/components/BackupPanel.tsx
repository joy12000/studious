// src/components/BackupPanel.tsx
import React, { useRef, useState } from 'react';
import { Download, Upload, Lock, Info } from 'lucide-react';
import { exportPlain, exportEncrypted, importPlain, importEncrypted } from '../lib/backup';

export default function BackupPanel(){
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const modeLabel = pass.trim() ? '암호화' : '일반';

  async function doExport(){
    try {
      setBusy(true);
      const blob = pass.trim()
        ? await exportEncrypted(pass)
        : await exportPlain();
      const name = pass.trim() ? 'selfdev-notes-backup.enc.json' : 'selfdev-notes-backup.json';
      triggerDownload(blob, name);
    } finally {
      setBusy(false);
    }
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setBusy(true);
      const count = pass.trim()
        ? await importEncrypted(f, pass)
        : await importPlain(f);
      alert(`${count}개의 노트를 복원했습니다.`);
      location.reload();
    } catch (err:any) {
      alert(`복원 실패: ${err?.message || err}`);
    } finally {
      setBusy(false);
      e.currentTarget.value = '';
    }
  }

  function askFile(){
    fileRef.current?.click();
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-gray-500" />
          <div>
            <div className="font-medium">백업 &amp; 복원</div>
            <div className="text-xs text-gray-500">
              암호 입력 시 <b>암호화</b>로 동작, 비우면 <b>일반</b>으로 동작합니다.
            </div>
          </div>
        </div>
        <span className="text-xs px-2 py-1 rounded-full border bg-gray-50 text-gray-700">
          현재 모드: <b>{modeLabel}</b>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={pass}
          onChange={e=>setPass(e.target.value)}
          placeholder="암호(선택) — 입력하면 암호화"
          className="flex-1 text-sm border rounded px-3 py-2"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          onClick={doExport}
          disabled={busy}
          className={`inline-flex items-center justify-center gap-2 px-3 py-3 rounded ${busy ? 'bg-gray-200 text-gray-500' : 'bg-blue-600 text-white hover:brightness-110'}`}
        >
          <Download className="h-4 w-4" />
          백업 다운로드
        </button>
        <button
          onClick={askFile}
          disabled={busy}
          className={`inline-flex items-center justify-center gap-2 px-3 py-3 rounded border ${busy ? 'bg-gray-100 text-gray-400' : 'bg-white hover:bg-gray-50'}`}
        >
          <Upload className="h-4 w-4" />
          파일에서 복원
        </button>
      </div>

      <input type="file" accept="application/json" className="hidden" ref={fileRef} onChange={onImportFile} />

      <div className="flex items-start gap-2 text-xs text-gray-500">
        <Info className="h-4 w-4 mt-0.5" />
        <div className="space-y-1">
          <div>암호화 백업은 AES‑GCM + PBKDF2로 보호됩니다. 암호를 잊으면 복원할 수 없습니다.</div>
          <div>일반 백업은 사람이 읽을 수 있으니 보관에 주의하세요.</div>
        </div>
      </div>
    </div>
  );
}

function triggerDownload(blob: Blob, name: string){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}