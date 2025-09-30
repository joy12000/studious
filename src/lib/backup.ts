// src/lib/backup.ts
import { db } from './db';
import { encryptJSON, decryptJSON, EncryptedPayload } from './crypto';
import type { Note, AppSettings } from './types';
import { v4 as uuidv4 } from 'uuid'; // 🚀 GEMINI: uuid 임포트

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
 * GEMINI: Exports a single note to a plain JSON file without encryption.
 * @param noteId The ID of the note to export.
 * @returns A Blob containing the JSON data.
 */
export async function exportPlainSingleNote(noteId: string): Promise<Blob> {
  const note = await db.notes.get(noteId);
  if (!note) {
    throw new Error('Note not found for export');
  }
  console.log('[exportPlainSingleNote] Note object before stringify:', note);
  // ExportedData a-lways expects a `notes` array
  const payload: ExportedData = { version: 1, exportedAt: Date.now(), notes: [note], settings: [] };
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
}

/**
 * Encrypts and exports all notes and settings to a JSON file.
 * @param passphrase The password to encrypt the backup.
 * @returns A Blob containing the encrypted JSON data.
 */
export async function exportEncrypted(passphrase: string, noteIds?: string[]): Promise<Blob> {
  let notes: Note[];
  if (noteIds && noteIds.length > 0) {
    notes = await db.notes.where('id').anyOf(noteIds).toArray();
  } else {
    notes = await db.notes.toArray();
  }
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
 * Adds notes from a backup data object to the database. This operation merges notes and does not clear existing data. It generates new IDs for imported notes to avoid conflicts.
 * @param data The backup data containing notes to add.
 * @returns The number of notes added.
 */
export async function addNotesFromBackup(data: ExportedData): Promise<number> {
  if (data?.version !== 1 || !Array.isArray(data.notes)) {
    throw new Error('Unknown or invalid backup format for adding notes.');
  }

  let addedCount = 0;
  await db.transaction('rw', db.notes, async () => {
    for (const note of data.notes) {
      // Generate a new ID for the imported note to avoid conflicts with existing notes
      const newNote = { ...note, id: uuidv4(), createdAt: Date.now(), updatedAt: Date.now() };
      await db.notes.add(newNote);
      addedCount++;
    }
  });
  return addedCount;
}

/**
 * Imports notes from a plain JSON file and adds them to the database.
 * @param file The File object to import.
 * @returns The number of notes added.
 */
export async function addPlainNotesFromFile(file: File): Promise<number> {
  try {
    const text = await file.text();
    const data = JSON.parse(text) as ExportedData;
    return await addNotesFromBackup(data);
  } catch (error) {
    console.error('Failed to add plain notes from file:', error);
    throw new Error('Invalid file or format for adding notes.');
  }
}

/**
 * Imports notes from an encrypted JSON file, decrypts them, and adds them to the database.
 * @param file The File object to import.
 * @param passphrase The password to decrypt the file.
 * @returns The number of notes added.
 */
export async function addEncryptedNotesFromFile(file: File, passphrase: string): Promise<number> {
  try {
    const text = await file.text();
    const encryptedPayload = JSON.parse(text) as EncryptedPayload;
    const data = await decryptJSON<ExportedData>(encryptedPayload, passphrase);
    return await addNotesFromBackup(data);
  } catch (error) {
    console.error('Failed to add encrypted notes from file:', error);
    throw new Error('Invalid file, format, or incorrect passphrase for adding notes.');
  }
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