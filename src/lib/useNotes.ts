import { useEffect, useState } from 'react';
import { db } from './db';
import { generateTitle, guessTopics } from './classify';

export function useNotes(filters: any) {
  const [notes, setNotes] = useState<any[]>([]);

  const load = async () => {
    let all = await db.notes.toArray();

    const s = (filters.search || '').toLowerCase().trim();
    if (s) {
      all = all.filter((n: any) =>
        (n.title || '').toLowerCase().includes(s) ||
        (n.content || '').toLowerCase().includes(s) ||
        (n.sourceUrl || '').toLowerCase().includes(s) ||
        (Array.isArray(n.topics) && n.topics.join(' ').toLowerCase().includes(s))
      );
    }

    if (filters.favorite) {
      all = all.filter((n: any) => !!n.favorite);
    }

    if (Array.isArray(filters.topics) && filters.topics.length) {
      all = all.filter(
        (n: any) =>
          Array.isArray(n.topics) &&
          filters.topics.every((t: string) => n.topics.includes(t))
      );
    }

    // 최신 업데이트 순으로 정렬
    all.sort(
      (a: any, b: any) =>
        (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
    );

    setNotes(all);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.search,
    filters.favorite,
    filters.dateRange,
    (filters.topics || []).join('|'),
  ]);

  return { notes, reload: load };
}

export async function addOrUpdateNote(note: any) {
  const content = String(note.content || '');

  if (!note.title || !String(note.title).trim()) {
    note.title = generateTitle(content);
  }

  if (!Array.isArray(note.topics) || note.topics.length === 0) {
    note.topics = await guessTopics(content);
  }

  note.updatedAt = Date.now();

  if (note.id) {
    return db.notes.put(note);
  }

  note.createdAt = Date.now();
  return db.notes.add(note);
}
