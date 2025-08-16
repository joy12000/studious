import { useEffect, useState, useCallback } from 'react';
import { db } from './db';
import { Note, SourceType } from './types';
import { generateTitle, guessTopics } from './classify';
import { createNote } from './note';

export type Filters = {
  search?: string;
  topics?: string[];
  favorite?: boolean;
  dateRange?: 'today' | '7days' | '30days' | 'all';
};

// Define the structure for the note creation payload.
export interface AddNotePayload {
  title?: string;
  content: string;
  sourceUrl?: string | null;
  sourceType?: SourceType;
}

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({ dateRange: 'all' });

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      // MOD: Dexie.js 쿼리 최적화를 위해 `where`를 `orderBy`보다 먼저 사용합니다.
      let query;
      if (filters.dateRange && filters.dateRange !== 'all') {
        const now = new Date();
        let cutoffDate: Date;
        if (filters.dateRange === 'today') {
          cutoffDate = new Date(now.setDate(now.getDate() - 1));
        } else if (filters.dateRange === '7days') {
          cutoffDate = new Date(now.setDate(now.getDate() - 7));
        } else { // 30days
          cutoffDate = new Date(now.setDate(now.getDate() - 30));
        }
        // `where`를 사용하여 인덱싱된 필터링을 수행합니다.
        query = db.notes.where('createdAt').above(cutoffDate.toISOString());
      } else {
        // 날짜 필터가 없으면 전체 테이블을 대상으로 합니다.
        query = db.notes.toCollection();
      }

      // 정렬은 항상 마지막에 적용합니다.
      let collection = await query.reverse().sortBy('createdAt');

      const searchQuery = (filters.search ?? '').trim().toLowerCase();
      if (searchQuery) {
        collection = collection.filter(n =>
          n.title.toLowerCase().includes(searchQuery) ||
          n.content.toLowerCase().includes(searchQuery)
        );
      }

      if (filters.topics && filters.topics.length > 0) {
        const topicSet = new Set(filters.topics);
        collection = collection.filter(n => n.topics.some(t => topicSet.has(t)));
      }

      if (filters.favorite) {
        collection = collection.filter(n => n.favorite);
      }

      setNotes(collection);
    } catch (error) {
      console.error("Failed to load notes:", error);
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const toggleFavorite = async (id: string) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    
    const updatedFavoriteStatus = !note.favorite;
    await db.notes.update(id, { favorite: updatedFavoriteStatus });

    setNotes(prevNotes =>
      prevNotes.map(n => n.id === id ? { ...n, favorite: updatedFavoriteStatus } : n)
    );
  };

  const addNote = async (payload: AddNotePayload) => {
    const newNote = await createNote(payload);
    // Add to local state to avoid a full reload
    setNotes(prevNotes => [newNote, ...prevNotes]);
    return newNote;
  };

  const updateNote = async (id: string, patch: Partial<Note>) => {
    await db.notes.update(id, patch);
    setNotes(prevNotes =>
      prevNotes.map(n => n.id === id ? { ...n, ...patch } : n)
    );
  };

  const deleteNote = async (id: string) => {
    await db.notes.delete(id);
    setNotes(prevNotes => prevNotes.filter(n => n.id !== id));
  };

  return { notes, loading, filters, setFilters, toggleFavorite, addNote, updateNote, deleteNote };
}
