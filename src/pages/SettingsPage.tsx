// src/pages/SettingsPage.tsx
import React, { useEffect } from 'react';
import BackupPanel from '../components/BackupPanel';
import { autoBackupIfNeeded } from '../lib/backup';

export default function SettingsPage(){
  useEffect(()=>{ autoBackupIfNeeded(); }, []);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-semibold">설정</h1>
        <p className="text-sm text-gray-500">백업/복원 및 기본 설정</p>
      </header>
      <BackupPanel />
    </div>
  );
}