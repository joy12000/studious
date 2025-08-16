// src/lib/backup.ts
import { db } from './db';
import { encryptJSON, decryptJSON, EncryptedPayload } from './crypto';
import type { Note, AppSettings } from './types';

/**
 * Defines the structure for the exported data, ensuring versioning.
 */
export type ExportedData = {
  version: 1;
  exportedAt: number;
  notes: Note[];
  settings: (AppSettings & { id: string })[];
};

/**
 * Exports all notes and settings to a plain JSON file.
 * @returns A Blob containing the JSON data.
 */
export async function exportPlain(): Promise<Blob> {
  const notes = await db.notes.toArray();
  const settings = await db.settings.toArray();
  const payload: ExportedData = { version: 1, exportedAt: Date.now(), notes, settings };
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
}

/**
 * Encrypts and exports all notes and settings to a JSON file.
 * @param passphrase The password to encrypt the backup.
 * @returns A Blob containing the encrypted JSON data.
 */
export async function exportEncrypted(passphrase: string): Promise<Blob> {
  const notes = await db.notes.toArray();
  const settings = await db.settings.toArray();
  const payload: ExportedData = { version: 1, exportedAt: Date.now(), notes, settings };
  const encryptedPayload = await encryptJSON(payload, passphrase);
  return new Blob([JSON.stringify(encryptedPayload)], { type: 'application/json' });
}

/**
 * Imports data from a plain JSON backup file.
 * @param file The File object to import.
 * @returns The number of notes imported.
 */
export async function importPlain(file: File): Promise<number> {
  try {
    const text = await file.text();
    const data = JSON.parse(text) as ExportedData;
    return await restore(data);
  } catch (error) {
    console.error('Failed to import plain backup:', error);
    throw new Error('Invalid backup file or format.');
  }
}

/**
 * Imports data from an encrypted JSON backup file.
 * @param file The File object to import.
 * @param passphrase The password to decrypt the backup.
 * @returns The number of notes imported.
 */
export async function importEncrypted(file: File, passphrase: string): Promise<number> {
  try {
    const text = await file.text();
    const encryptedPayload = JSON.parse(text) as EncryptedPayload;
    const data = await decryptJSON<ExportedData>(encryptedPayload, passphrase);
    return await restore(data);
  } catch (error) {
    console.error('Failed to import encrypted backup:', error);
    throw new Error('Invalid backup file, format, or incorrect passphrase.');
  }
}

/**
 * Restores the database from a backup data object.
 * This is a destructive operation: it clears existing data before importing.
 * @param data The backup data to restore.
 * @returns The number of notes restored.
 */
async function restore(data: ExportedData): Promise<number> {
  if (data?.version !== 1 || !Array.isArray(data.notes) || !Array.isArray(data.settings)) {
    throw new Error('Unknown or invalid backup format.');
  }

  await db.transaction('rw', db.notes, db.settings, async () => {
    // Clear existing data for a clean restore.
    await db.notes.clear();
    await db.settings.clear();

    // Bulk-insert the backup data for better performance.
    await db.notes.bulkPut(data.notes);
    await db.settings.bulkPut(data.settings);
  });

  try {
    localStorage.setItem('lastBackupRestoreAt', String(Date.now()));
  } catch (err) {
    console.error('Failed to set lastBackupRestoreAt in localStorage:', err);
  }

  return data.notes.length;
}

/**
 * Triggers a plain JSON backup download if it hasn't happened in the last week.
 */
export async function autoBackupIfNeeded() {
  try {
    const lastBackupAt = Number(localStorage.getItem('lastBackupAt') || '0');
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    if (Date.now() - lastBackupAt < ONE_WEEK_MS) {
      return;
    }

    const blob = await exportPlain();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateString = new Date().toISOString().slice(0, 10);
    a.download = `selfdev-notes-backup-${dateString}.json`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up the DOM and revoke the object URL.
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    localStorage.setItem('lastBackupAt', String(Date.now()));
  } catch (e) {
    console.warn('[autoBackup] Failed to create automatic backup:', e);
  }
}
