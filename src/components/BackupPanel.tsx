// src/components/BackupPanel.tsx
import React, { useState } from 'react';
import { exportPlain, exportEncrypted, importPlain, importEncrypted } from '../lib/backup';
import { Download, Upload, Lock } from 'lucide-react';

export default function BackupPanel(){
  const [pass, setPass] = useState('');

  async function doExportPlain(){
    const blob = await exportPlain();
    triggerDownload(blob, 'selfdev-notes-backup.json');
  }
  async function doExportEncrypted(){
    if (!pass) { alert('암호를 입력해 주세요'); return; }
    const blob = await exportEncrypted(pass);
    triggerDownload(blob, 'selfdev-notes-backup.enc.json');
  }
  async function onImportPlain(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0]; if (!f) return;
    const count = await importPlain(f);
    alert(`${count}개의 노트를 복원했습니다.`);
    e.currentTarget.value = '';
    location.reload();
  }
  async function onImportEncrypted(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0]; if (!f) return;
    if (!pass) { alert('암호를 입력해 주세요'); return; }
    const count = await importEncrypted(f, pass);
    alert(`${count}개의 노트를 복원했습니다.`);
    e.currentTarget.value = '';
    location.reload();
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
      <h2 className="text-base font-semibold">백업 & 복원</h2>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <button onClick={doExportPlain} className="inline-flex items-center gap-2 px-3 py-2 rounded bg-blue-600 text-white">
            <Download className="h-4 w-4" /> 백업(일반 JSON)
          </button>
          <label className="block">
            <span className="text-xs text-gray-500">복원(일반 JSON)</span>
            <input type="file" accept="application/json" onChange={onImportPlain} className="block mt-1 text-sm" />
          </label>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-gray-500" />
            <input value={pass} onChange={e=>setPass(e.target.value)} placeholder="암호(암호화 백업/복원 공용)"
              className="flex-1 text-sm border rounded px-2 py-1" />
          </div>
          <button onClick={doExportEncrypted} className="inline-flex items-center gap-2 px-3 py-2 rounded bg-indigo-600 text-white">
            <Download className="h-4 w-4" /> 백업(암호화)
          </button>
          <label className="block">
            <span className="text-xs text-gray-500">복원(암호화 JSON)</span>
            <input type="file" accept="application/json" onChange={onImportEncrypted} className="block mt-1 text-sm" />
          </label>
        </div>
      </div>
      <p className="text-xs text-gray-500">주의: 암호를 잊으면 암호화 백업은 복원할 수 없습니다.</p>
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