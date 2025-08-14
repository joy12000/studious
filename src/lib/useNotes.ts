import { useEffect, useMemo, useState } from 'react';
import { db } from './db';
import { generateTitle, guessTopics } from './classify';

export type Filters = {
  search?: string;
  topics?: string[];
  favorite?: boolean;
  dateRange?: 'today' | '7days' | '30days' | 'all';
};

export function useNotes() {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({ search: '' });

  const filterKey = useMemo(() => JSON.stringify({
    search: filters.search ?? '',
    topics: filters.topics ?? [],
    favorite: !!filters.favorite,
    dateRange: filters.dateRange ?? 'all',
  }), [filters.search, JSON.stringify(filters.topics ?? []), filters.favorite, filters.dateRange]);

  const load = async () => {
    setLoading(true);
    let all = await db.notes.toArray();
    // normalize
    all = (all || []).map(n => ({
      labels: [], highlights: [], todo: [], favorite: false, sourceType: 'other',
      ...n
    }));
    // filtering
    const q = (filters.search ?? '').trim().toLowerCase();
    if (q) {
      all = all.filter(n => (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q));
    }
    if (filters.topics && filters.topics.length) {
      all = all.filter(n => (n.topics || []).some((t: string) => filters.topics!.includes(t)));
    }
    if (filters.favorite) {
      all = all.filter(n => !!n.favorite);
    }
    if (filters.dateRange && filters.dateRange !== 'all') {
      const now = Date.now();
      const cutoff =
        filters.dateRange === 'today' ? (now - 24*60*60*1000) :
        filters.dateRange === '7days' ? (now - 7*24*60*60*1000) :
        (now - 30*24*60*60*1000);
      all = all.filter(n => (n.createdAt ?? 0) >= cutoff);
    }
    // sort new first
    all.sort((a,b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    setNotes(all);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filterKey]);

  const toggleFavorite = async (id: string) => {
    const row = await db.notes.get(id);
    if (!row) return;
    await db.notes.update(id, { favorite: !row.favorite, updatedAt: Date.now() });
    await load();
  };

  // Backward-compatible addNote
  const addNote = async (arg1: any, arg2?: string | null) => {
    // - addNote(content: string, sourceUrl?)
    // - addNote({ title?, content, sourceUrl?, sourceType? })
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
      if (arg1.sourceType === 'youtube' || arg1.sourceType === 'web' || arg1.sourceType === 'other') {
        sourceType = arg1.sourceType;
      } else if (sourceUrl) {
        sourceType = sourceUrl.includes('youtube.com') || sourceUrl.includes('youtu.be') ? 'youtube' : 'web';
      }
    }

    if (!content) throw new Error('내용이 비어 있음');

    const id = crypto.randomUUID();
    const title = titleFromUser || (await generateTitle(content));
    const topics = await guessTopics(content);
    const now = Date.now();
    const note = {
      id, title, content,
      sourceUrl,
      sourceType,
      createdAt: now,
      updatedAt: now,
      topics,
      labels: [],
      highlights: [],
      todo: [],
      favorite: false
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

  // helper: safeSetFilters to avoid identical updates
  function safeSetFilters(next: Filters) {
    const prev = filters;
    const same =
      (prev.search ?? '') === (next.search ?? '') &&
      JSON.stringify(prev.topics ?? []) === JSON.stringify(next.topics ?? []) &&
      !!prev.favorite === !!next.favorite &&
      (prev.dateRange ?? 'all') === (next.dateRange ?? 'all');
    if (same) return;
    setFilters(next);
  }

  return { notes, loading, filters, setFilters: safeSetFilters, toggleFavorite, addNote, updateNote, deleteNote };
}
