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
    all = (all || []).map(n => ({ labels: [], highlights: [], todo: [], favorite: false, sourceType: 'other', ...n }));
    const q = (filters.search ?? '').trim().toLowerCase();
    if (q) all = all.filter(n => (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q));
    if (filters.topics && filters.topics.length) all = all.filter(n => (n.topics || []).some((t: string) => filters.topics!.includes(t)));
    if (filters.favorite) all = all.filter(n => !!n.favorite);
    if (filters.dateRange && filters.dateRange !== 'all') {
      const now = Date.now();
      const cutoff = filters.dateRange === 'today' ? (now - 86400000) : filters.dateRange === '7days' ? (now - 604800000) : (now - 2592000000);
      all = all.filter(n => (n.createdAt ?? 0) >= cutoff);
    }
    all.sort((a,b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    setNotes(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filters]);

  const toggleFavorite = async (id: string) => {
    const row = await db.notes.get(id);
    if (!row) return;
    await db.notes.update(id, { favorite: !row.favorite, updatedAt: Date.now() });
    await load();
  };

  const addNote = async (arg1: any, arg2?: string | null) => {
    let content = '';
    let sourceUrl: string | null = null;
    let sourceType: 'youtube' | 'web' | 'other' = 'other';
    let titleFromUser: string | undefined;

    if (typeof arg1 === 'string') {
      content = (arg1 ?? '').trim();
      sourceUrl = (arg2 ?? null) as any;
    } else if (arg1 && typeof arg1 === 'object') {
      content = (arg1.content ?? '').trim();
      titleFromUser = (arg1.title ?? '').trim() || undefined;
      sourceUrl = (arg1.sourceUrl ?? null) ? String(arg1.sourceUrl).trim() : null;
      if (arg1.sourceType === 'youtube' || arg1.sourceType === 'web' || arg1.sourceType === 'other') sourceType = arg1.sourceType;
      else if (sourceUrl) sourceType = sourceUrl.includes('youtube.com') || sourceUrl.includes('youtu.be') ? 'youtube' : 'web';
    }

    if (!content) throw new Error('내용이 비어 있음');

    const id = crypto.randomUUID();
    const title = titleFromUser || (await generateTitle(content));
    const topics = await guessTopics(content);
    const now = Date.now();
    const note = { id, title, content, sourceUrl, sourceType, createdAt: now, updatedAt: now, topics, labels: [], highlights: [], todo: [], favorite: false };
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
