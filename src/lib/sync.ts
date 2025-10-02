import { db } from './db';
import { createClient } from '@supabase/supabase-js';
import { Note, Subject, Folder } from './types';

// Supabase 'notes' table schema mapped to a type
type RemoteNote = {
    id: string;
    user_id: string;
    title: string | null;
    content: string | null;
    note_type: Note['noteType'] | null;
    subject_id: string | null;
    folder_id: string | null;
    source_type: Note['sourceType'] | null;
    source_url: string | null;
    created_at: string;
    updated_at: string;
    note_date: string | null;
    key_insights: string[] | null;
    favorite: boolean;
    attachments: Note['attachments'] | null;
    is_deleted: boolean;
};

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

    // --- 1. SUBJECT SYNC ---
    const { data: remoteSubjects, error: remoteSubjectsError } = await supabase.from('subjects').select('*');
    if (remoteSubjectsError) throw new Error(`Failed to fetch subjects: ${remoteSubjectsError.message}`);
    
    const localSubjects = await db.subjects.toArray();
    const remoteSubjectsMap = new Map(remoteSubjects.map(s => [s.id, s]));

    // Push local subjects that don't exist on remote
    const subjectsToUpsert = localSubjects.filter(localSub => !remoteSubjectsMap.has(localSub.id));
    if (subjectsToUpsert.length > 0) {
        const { error } = await supabase.from('subjects').upsert(subjectsToUpsert.map(s => ({ ...s, user_id: userId })));
        if (error) throw new Error(`Failed to upsert subjects: ${error.message}`);
    }

    // Pull remote subjects that don't exist locally
    const subjectsToPutLocally = remoteSubjects.filter(remoteSub => !localSubjects.some(localSub => localSub.id === remoteSub.id));
    if (subjectsToPutLocally.length > 0) {
        await db.subjects.bulkPut(subjectsToPutLocally as Subject[]);
    }

    // --- 2. FOLDER SYNC ---
    const { data: remoteFolders, error: remoteFoldersError } = await supabase.from('folders').select('*');
    if (remoteFoldersError) throw new Error(`Failed to fetch folders: ${remoteFoldersError.message}`);
    
    const localFolders = await db.folders.toArray();
    const remoteFoldersMap = new Map(remoteFolders.map(f => [f.id, f]));

    // Push local folders that don't exist on remote
    const foldersToUpsert = localFolders.filter(localFolder => !remoteFoldersMap.has(localFolder.id));
    if (foldersToUpsert.length > 0) {
        const { error } = await supabase.from('folders').upsert(foldersToUpsert.map(f => ({ ...f, user_id: userId })));
        if (error) throw new Error(`Failed to upsert folders: ${error.message}`);
    }

    // Pull remote folders that don't exist locally
    const foldersToPutLocally = remoteFolders.filter(remoteFolder => !localFolders.some(localFolder => localFolder.id === remoteFolder.id));
    if (foldersToPutLocally.length > 0) {
        await db.folders.bulkPut(foldersToPutLocally as Folder[]);
    }

    // --- 3. NOTE SYNC ---
    const { data: remoteNotesData, error: remoteError } = await supabase
        .from('notes')
        .select('*');

    if (remoteError) throw remoteError;

    const remoteNotes = remoteNotesData as RemoteNote[];
    const allLocalNotes = await db.notes.toArray();

    const remoteNotesMap = new Map(remoteNotes.map(n => [n.id, n]));

    const notesToPutLocally: Note[] = [];
    const idsToDeleteLocally: string[] = [];
    const notesToUpsertToRemote: Note[] = [];

    // PULL logic
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
                folderId: remoteNote.folder_id || undefined,
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

    // PUSH logic
    for (const localNote of allLocalNotes) {
        const remoteNote = remoteNotesMap.get(localNote.id);
        if (!remoteNote || localNote.updatedAt > new Date(remoteNote.updated_at).getTime()) {
            notesToUpsertToRemote.push(localNote);
        }
    }

    // Execute DB operations
    if (notesToUpsertToRemote.length > 0) {
        const upsertData = notesToUpsertToRemote.map(n => ({
            id: n.id,
            user_id: userId,
            title: n.title,
            content: n.content,
            note_type: n.noteType,
            subject_id: n.subjectId,
            folder_id: n.folderId,
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
