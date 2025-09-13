import { useEffect, useState, useCallback } from 'react';
import { db } from './db';
import { Note } from './types';

export type Filters = {
  search?: string;
  tag?: string;
  favorite?: boolean;
  dateRange?: 'today' | '7days' | '30days' | 'all';
};

// 🚀 addNote의 인자 타입을 확장하여 콜백 함수들을 포함
export interface AddNotePayload {
  youtubeUrl: string;
  onProgress: (status: string) => void;
  onComplete: (note: Note) => void;
  onError: (error: string) => void;
}

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({ dateRange: 'all' });

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
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
        query = db.notes.where('createdAt').above(cutoffDate.toISOString());
      } else {
        query = db.notes.toCollection();
      }

      let notesFromDb = await query.reverse().sortBy('createdAt');

      if (filters.search) {
        const searchQuery = filters.search.toLowerCase();
        notesFromDb = notesFromDb.filter(n =>
          n.title.toLowerCase().includes(searchQuery) ||
          n.content.toLowerCase().includes(searchQuery)
        );
      }

      if (filters.tag) {
        notesFromDb = notesFromDb.filter(n => n.tag === filters.tag);
      }

      if (filters.favorite) {
        notesFromDb = notesFromDb.filter(n => n.favorite);
      }

      setNotes(notesFromDb);
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

  // 🚀 SSE를 처리하도록 addNote 함수 수정
  const addNote = async (payload: AddNotePayload) => {
    const { youtubeUrl, onProgress, onComplete, onError } = payload;

    onProgress("오디오를 처리하여 요약을 생성하는 중입니다...");

    try {
      const response = await fetch(`/api/summarize_audio?youtubeUrl=${encodeURIComponent(youtubeUrl)}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      const newNote: Note = {
        id: crypto.randomUUID(),
        title: result.title,
        content: result.summary,
        key_insights: result.key_insights,
        tag: result.tag,
        sourceUrl: result.sourceUrl,
        sourceType: 'youtube',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().getTime(),
        topics: [result.tag],
        labels: [],
        highlights: [],
        todo: [],
        favorite: false,
        attachments: [],
      };

      await db.notes.add(newNote);
      setNotes(prevNotes => [newNote, ...prevNotes]);
      onComplete(newNote);

    } catch (err) {
      console.error("Summarization failed:", err);
      const message = err instanceof Error ? err.message : "요약 중 알 수 없는 오류가 발생했습니다.";
      onError(message);
    }
  };
  
  const updateNote = async (id: string, patch: Partial<Note>) => {
    await db.notes.update(id, { ...patch, updatedAt: new Date().getTime() });
    setNotes(prevNotes =>
      prevNotes.map(n => n.id === id ? { ...n, ...patch, updatedAt: new Date().getTime() } : n)
    );
  };

  const deleteNote = async (id: string) => {
    await db.notes.delete(id);
    setNotes(prevNotes => prevNotes.filter(n => n.id !== id));
  };

  return { notes, loading, filters, setFilters, toggleFavorite, addNote, updateNote, deleteNote };
}
