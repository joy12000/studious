// src/lib/backup.ts
import { db } from './db';
import { encryptJSON, decryptJSON } from './crypto';

export type ExportedData = {
  version: 1,
  exportedAt: number,
  notes: any[],
  settings: any[]
};

export async function exportPlain(): Promise<Blob> {
  const notes = await db.notes.toArray();
  const settings = await db.settings.toArray();
  const payload: ExportedData = { version: 1, exportedAt: Date.now(), notes, settings };
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
}

export async function exportEncrypted(passphrase: string): Promise<Blob> {
  const notes = await db.notes.toArray();
  const settings = await db.settings.toArray();
  const payload: ExportedData = { version: 1, exportedAt: Date.now(), notes, settings };
  const enc = await encryptJSON(payload, passphrase);
  return new Blob([JSON.stringify(enc)], { type: 'application/json' });
}

export async function importPlain(file: File): Promise<number> {
  const text = await file.text();
  const json = JSON.parse(text);
  return restore(json);
}

export async function importEncrypted(file: File, passphrase: string): Promise<number> {
  const text = await file.text();
  const json = JSON.parse(text);
  const dec = await decryptJSON(json, passphrase);
  return restore(dec);
}

async function restore(data: ExportedData): Promise<number> {
  if (!data || data.version !== 1) throw new Error('Unknown backup format');
  // naive merge: upsert notes/settings
  const tx = db.transaction('rw', db.notes, db.settings, async () => {
    for (const n of data.notes || []) await db.notes.put(n);
    for (const s of data.settings || []) await db.settings.put(s);
  });
  await tx;
  try { localStorage.setItem('lastBackupRestoreAt', String(Date.now())); } catch {}
  return (data.notes || []).length;
}

// Weekly auto-backup trigger (download .json)
export async function autoBackupIfNeeded() {
  try {
    const last = Number(localStorage.getItem('lastBackupAt') || '0');
    const week = 1000 * 60 * 60 * 24 * 7;
    if (Date.now() - last < week) return;
    const blob = await exportPlain();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const d = new Date().toISOString().slice(0,10);
    a.download = `selfdev-notes-backup-${d}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    localStorage.setItem('lastBackupAt', String(Date.now()));
  } catch (e) {
    console.warn('[autoBackup]', e);
  }
}