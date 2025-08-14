import { useEffect, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { db } from './db';
import { generateTitle, guessTopics } from './classify';
import type { Note } from './types';

export type Filters = {
  search?: string;
  topics?: string[];
  favorite?: boolean;
  dateRange?: 'today' | '7days' | '30days' | 'all';
};

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({ search: '' });

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      const all = await db.notes.orderBy('createdAt').reverse().toArray();
      if (alive) {
        setNotes(all);
        setLoading(false);
      }
    }
    load();
    const onUpdate = () => load();
    db.notes.hook('creating', onUpdate);
    db.notes.hook('updating', onUpdate);
    db.notes.hook('deleting', onUpdate);
    return () => {
      alive = false;
      db.notes.hook('creating').unsubscribe(onUpdate);
      db.notes.hook('updating').unsubscribe(onUpdate);
      db.notes.hook('deleting').unsubscribe(onUpdate);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = (filters.search || '').toLowerCase();
    const inTopics = (filters.topics && filters.topics.length) ? new Set(filters.topics) : null;
    const now = Date.now();
    const within = (createdAt: number) => {
      switch (filters.dateRange) {
        case 'today': return now - createdAt <= 24*60*60*1000;
        case '7days': return now - createdAt <= 7*24*60*60*1000;
        case '30days': return now - createdAt <= 30*24*60*60*1000;
        default: return true;
      }
    };
    return notes.filter(n => {
      if (q && !n.content.toLowerCase().includes(q) && !(n.title||'').toLowerCase().includes(q)) return false;
      if (inTopics && !n.topics.some(t => inTopics.has(t))) return false;
      if (filters.favorite && !n.favorite) return false;
      if (!within(n.createdAt)) return false;
      return true;
    });
  }, [notes, filters]);

  async function addNote(content: string) {
    const id = uuid();
    const topics = await guessTopics(content);
    const title = generateTitle(content);
    const now = Date.now();
    const note: Note = { id, content, topics, favorite: false, createdAt: now, title, sourceType: 'manual', todo: [] };
    await db.notes.put(note);
    return id;
  }

  async function updateNote(id: string, patch: Partial<Note>) {
    await db.notes.update(id, patch);
  }

  async function deleteNote(id: string) {
    await db.notes.delete(id);
  }

  function toggleFavorite(id: string) {
    const n = notes.find(n => n.id === id);
    if (!n) return;
    updateNote(id, { favorite: !n.favorite });
  }

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

  return { notes: filtered, allNotes: notes, loading, filters, setFilters: safeSetFilters, toggleFavorite, addNote, updateNote, deleteNote };
}
