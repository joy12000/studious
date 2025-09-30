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
    userId: string,
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
    const allLocalNotes = await db.notes.toArray(); // Get all notes, including soft-deleted

    const remoteNotesMap = new Map(remoteNotes.map(n => [n.id, n]));

    const notesToPutLocally: Note[] = [];
    const idsToDeleteLocally: string[] = [];
    const notesToUpsertToRemote: Note[] = [];

    // 3. Compare remote to local (PULL logic)
    for (const remoteNote of remoteNotes) {
        const localNote = allLocalNotes.find(n => n.id === remoteNote.id);
        const remoteUpdatedAt = new Date(remoteNote.updated_at).getTime();

        if (remoteNote.is_deleted) {
            if (localNote) idsToDeleteLocally.push(remoteNote.id);
            continue;
        }

        if (!localNote || remoteUpdatedAt > localNote.updatedAt) {
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
                is_deleted: remoteNote.is_deleted,
            };
            notesToPutLocally.push(noteToStore);
        }
    }

    // 4. Compare local to remote (PUSH logic)
    for (const localNote of allLocalNotes) {
        const remoteNote = remoteNotesMap.get(localNote.id);
        if (!remoteNote || localNote.updatedAt > new Date(remoteNote.updated_at).getTime()) {
            notesToUpsertToRemote.push(localNote);
        }
    }

    // 5. Execute DB operations
    if (notesToUpsertToRemote.length > 0) {
        const upsertData = notesToUpsertToRemote.map(n => ({
            id: n.id,
            user_id: userId,
            title: n.title,
            content: n.content,
            note_type: n.noteType,
            subject_id: n.subjectId,
            source_type: n.sourceType,
            source_url: n.sourceUrl,
            created_at: n.createdAt,
            updated_at: new Date(n.updatedAt).toISOString(),
            note_date: n.noteDate,
            key_insights: n.key_insights,
            favorite: n.favorite,
            attachments: n.attachments,
            is_deleted: n.is_deleted || false,
        }));
        const { error } = await supabase.from('notes').upsert(upsertData);
        if (error) throw new Error(`Failed to upsert notes to Supabase: ${error.message}`);
    }

    if (notesToPutLocally.length > 0) {
        await db.notes.bulkPut(notesToPutLocally);
    }
    if (idsToDeleteLocally.length > 0) {
        await db.notes.bulkDelete(idsToDeleteLocally);
    }

    return {
        addedOrUpdated: notesToPutLocally.length,
        deleted: idsToDeleteLocally.length,
        pushed: notesToUpsertToRemote.length,
    };
}
