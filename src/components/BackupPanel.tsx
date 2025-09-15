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
    // React 이벤트 비동기 사용 시 currentTarget이 null이 될 수 있으므로 참조를 먼저 잡아둔다.
    const inputEl = e.currentTarget as HTMLInputElement | null;
    const f = inputEl?.files?.[0];
    if (!f) return;
    try {
      setBusy(true);
      const count = pass.trim()
        ? await importEncrypted(f, pass)
        : await importPlain(f);
      alert(`${count}개의 노트를 복원했습니다.`);
      // 파일 입력값 초기화는 reload 전에 안전하게 ref로 처리
      if (fileRef.current) fileRef.current.value = '';
      // 바로 새로고침
      location.reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`복원 실패: ${message}`);
    } finally {
      setBusy(false);
      // 이벤트가 null이더라도 안전하게 처리
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function askFile(){
    fileRef.current?.click();
  }

  return (
    <div className="p-6 bg-card/60 backdrop-blur-lg rounded-2xl shadow-lg border border-card/20 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <div>
            <div className="font-medium">백업 &amp; 복원</div>
            <div className="text-xs text-muted-foreground/80">
              암호 입력 시 <b>암호화</b>로 동작, 비우면 <b>일반</b>으로 동작합니다.
            </div>
          </div>
        </div>
        <span className="text-xs px-2 py-1 rounded-full border bg-muted/70 text-muted-foreground">
          현재 모드: <b>{modeLabel}</b>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={pass}
          onChange={e=>setPass(e.target.value)}
          placeholder="암호(선택) — 입력하면 암호화"
          className="flex-1 text-sm border bg-card/50 rounded-lg px-3 py-2 focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
          autoComplete="new-password"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={doExport}
          disabled={busy}
          className={`inline-flex items-center justify-center gap-2 px-3 py-3 rounded-lg font-semibold transition-colors ${busy ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
        >
          <Download className="h-4 w-4" />
          백업 다운로드
        </button>
        <button
          onClick={askFile}
          disabled={busy}
          className={`inline-flex items-center justify-center gap-2 px-3 py-3 rounded-lg border transition-colors ${busy ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'border bg-card/50 hover:bg-card/80'}`}
        >
          <Upload className="h-4 w-4" />
          파일에서 복원
        </button>
      </div>

      <input type="file" accept="application/json" className="hidden" ref={fileRef} onChange={onImportFile} />

      <div className="flex items-start gap-3 text-xs text-muted-foreground/80">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
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