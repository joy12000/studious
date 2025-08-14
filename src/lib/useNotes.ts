import { useEffect, useState } from 'react';
import { db } from './db';
import { generateTitle, guessTopics } from './classify';

type Filters = {
  search?: string;
  topics?: string[];
  favorite?: boolean;
  dateRange?: 'today' | '7days' | '30days' | 'all';
};

export function useNotes() {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({ search: '' });

  const load = async () => {
    setLoading(true);
    let all = await db.notes.toArray();

    const s = (filters?.search || '').toLowerCase().trim();
    if (s) {
      all = all.filter((n: any) =>
        (n.title || '').toLowerCase().includes(s) ||
        (n.content || '').toLowerCase().includes(s) ||
        (n.sourceUrl || '').toLowerCase().includes(s)
      );
    }
    if (filters?.favorite) {
      all = all.filter((n: any) => !!n.favorite);
    }
    if (Array.isArray(filters?.topics) && filters.topics.length) {
      all = all.filter((n: any) => Array.isArray(n.topics) && filters.topics!.every(t => n.topics.includes(t)));
    }

    all.sort((a: any, b: any) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    setNotes(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, [JSON.stringify(filters)]);

  const toggleFavorite = async (id: string) => {
    const row = await db.notes.get(id);
    if (!row) return;
    await db.notes.update(id, { favorite: !row.favorite, updatedAt: Date.now() });
    await load();
  };

  const addNote = async (content: string, sourceUrl?: string | null) => {
    const id = crypto.randomUUID();
    const title = await generateTitle(content);
    const topics = await guessTopics(content);
    const now = Date.now();
    const note = {
      id, title, content, sourceUrl: sourceUrl || null, sourceType: 'other',
      createdAt: now, updatedAt: now, topics, labels: [], highlights: [], todo: [], favorite: false
    };
    await db.notes.add(note);
    await load();
    return id;
  };

  const updateNote = async (id: string, patch: any) => {
    await db.notes.update(id, { ...patch, updatedAt: Date.now() });
    await load();
  };

  const deleteNote = async (id: string) => {
    await db.notes.delete(id);
    await load();
  };

  return { notes, loading, filters, setFilters, toggleFavorite, addNote, updateNote, deleteNote };
}
