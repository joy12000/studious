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
  const addNote = (payload: AddNotePayload) => {
    const { youtubeUrl, onProgress, onComplete, onError } = payload;

    // POST 요청을 사용하므로 EventSource 대신 fetch 스트림을 직접 처리해야 합니다.
    // 하지만 Vercel의 서버리스 환경과 요청 본문(body)의 필요성 때문에
    // EventSource를 사용하기 위해 GET 요청으로 다시 전환합니다.
    const eventSource = new EventSource(`/api/summarize-youtube?youtubeUrl=${encodeURIComponent(youtubeUrl)}`);

    eventSource.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.error) {
        onError(data.error);
        eventSource.close();
        return;
      }

      if (data.status === "완료" && data.payload) {
        const result = data.payload;
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
        eventSource.close();
      } else {
        onProgress(data.status);
      }
    };

    eventSource.onerror = (err) => {
      console.error("EventSource failed:", err);
      onError("요약 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요.");
      eventSource.close();
    };

    // addNote 함수는 이제 eventSource를 반환하여 호출 측에서 닫을 수 있도록 할 수 있습니다.
    return eventSource;
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
