import { useEffect, useState, useCallback } from 'react';
import { db } from './db';
import { Note, SourceType, Attachment } from './types';

export type Filters = {
  search?: string;
  tag?: string; // topics -> tag로 변경
  favorite?: boolean;
  dateRange?: 'today' | '7days' | '30days' | 'all';
};

// 🚀 기존 AddNotePayload 인터페이스를 youtubeUrl만 받도록 수정
export interface AddNotePayload {
  youtubeUrl: string;
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

      // 🚀 tag 필터링 적용
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

  const addNote = async (payload: AddNotePayload) => {
    // 🚀 서버리스 함수 호출 로직
    const response = await fetch('/api/summarize-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl: payload.youtubeUrl })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to summarize video.');
    }

    const result = await response.json();

    // 🚀 서버로부터 받은 데이터로 최종 Note 객체 생성
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
      topics: [result.tag], // 레거시 호환성을 위해 tag를 topics 배열에 넣어줌
      labels: [],
      highlights: [],
      todo: [],
      favorite: false,
      attachments: [],
    };

    await db.notes.add(newNote);
    
    // 로컬 상태 업데이트
    setNotes(prevNotes => [newNote, ...prevNotes]);
    return newNote;
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