import { db } from './db';
import { createClient } from '@supabase/supabase-js';
import { Note } from './types';

// Supabase 'notes' table schema mapped to a type
type RemoteNote = {
    id: string;
    user_id: string;
    title: string | null;
    content: string | null;
    note_type: Note['noteType'] | null;
    subject_id: string | null;
    source_type: Note['sourceType'] | null;
    source_url: string | null;
    created_at: string;
    updated_at: string;
    note_date: string | null;
    key_insights: string[] | null;
    favorite: boolean;
    attachments: Note['attachments'] | null;
    chatHistory: Note['chatHistory'] | null;
    is_deleted: boolean;
};

/**
 * Fetches notes from Supabase and syncs them to the local Dexie database.
 * This is a PULL-only sync. It will:
 * - Add notes from remote that are not local.
 * - Update local notes if the remote version is newer.
 * - Delete local notes if they are marked as `is_deleted` on remote.
 */
export async function syncNotes(
    getToken: (options?: { template?: string }) => Promise<string | null>
) {
    // 1. Get Supabase client with Clerk JWT
    const token = await getToken({ template: 'supabase' });
    if (!token) throw new Error('Not authenticated for sync');

    const supabase = createClient(
        import.meta.env.VITE_PUBLICSUPABASE_URL!,
        import.meta.env.VITE_PUBLICSUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    // 2. Fetch all remote and local notes
    const { data: remoteNotesData, error: remoteError } = await supabase
        .from('notes')
        .select('*');

    if (remoteError) throw remoteError;

    const remoteNotes = remoteNotesData as RemoteNote[];
    const localNotes = await db.notes.toArray();
    const localNotesMap = new Map(localNotes.map(n => [n.id, n]));

    const notesToPutLocally: Note[] = [];
    const idsToDeleteLocally: string[] = [];

    // 3. Compare remote notes to local notes
    for (const remoteNote of remoteNotes) {
        const localNote = localNotesMap.get(remoteNote.id);
        const remoteUpdatedAt = new Date(remoteNote.updated_at).getTime();

        // If remote note is marked as deleted, ensure it's deleted locally
        if (remoteNote.is_deleted) {
            if (localNote) {
                idsToDeleteLocally.push(remoteNote.id);
            }
            continue;
        }

        // Convert remote note format to local Note format
        const noteToStore: Note = {
            id: remoteNote.id,
            title: remoteNote.title || '',
            content: remoteNote.content || '',
            noteType: remoteNote.note_type || 'general',
            subjectId: remoteNote.subject_id || undefined,
            sourceType: remoteNote.source_type || 'other',
            sourceUrl: remoteNote.source_url,
            createdAt: remoteNote.created_at,
            updatedAt: remoteUpdatedAt,
            noteDate: remoteNote.note_date || undefined,
            key_insights: remoteNote.key_insights || [],
            favorite: remoteNote.favorite,
            attachments: remoteNote.attachments || undefined,
            chatHistory: remoteNote.chatHistory || undefined,
        };

        // If note doesn't exist locally OR remote is newer, schedule for local update/add
        if (!localNote || remoteUpdatedAt > localNote.updatedAt) {
            notesToPutLocally.push(noteToStore);
        }
    }

    // 4. Execute batch operations on local DB
    if (notesToPutLocally.length > 0) {
        await db.notes.bulkPut(notesToPutLocally);
    }
    if (idsToDeleteLocally.length > 0) {
        await db.notes.bulkDelete(idsToDeleteLocally);
    }

    return {
        addedOrUpdated: notesToPutLocally.length,
        deleted: idsToDeleteLocally.length,
    };
}
