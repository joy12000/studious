import { useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
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
  const [filters, setFilters] = useState<Filters>({ dateRange: 'all' });

  const notes = useLiveQuery(async () => {
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

    let notesFromDb = await query.reverse().sortBy('updatedAt');

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

    return notesFromDb;
  }, [filters]);

  const loading = notes === undefined;

  const toggleFavorite = async (id: string) => {
    const note = await db.notes.get(id);
    if (!note) return;
    await db.notes.update(id, { favorite: !note.favorite });
  };

  // 🚀 SSE를 처리하도록 addNote 함수 수정
  const addNote = async (payload: AddNotePayload) => {
    const { youtubeUrl, onProgress, onComplete, onError } = payload;

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      onProgress("유튜브 자막을 추출하고 있습니다...");
      await sleep(1200);

      onProgress("AI가 핵심 내용을 요약하고 있습니다...");

      const response = await fetch(`/api/summarize_youtube?youtubeUrl=${encodeURIComponent(youtubeUrl)}&_cacheBust=${Date.now()}`);
      
      const contentType = response.headers.get("content-type");
      const isJson = contentType && contentType.includes("application/json");

      // 응답이 정상이 아니거나 JSON이 아니면, 디버깅을 위해 응답 내용을 그대로 에러로 표시
      if (!response.ok || !isJson) {
        const errorBody = await response.text();
        throw new Error(`[Debug] 서버 비정상 응답 (상태: ${response.status}): 

${errorBody.substring(0, 1000)}`);
      }

      // 이제 응답이 JSON임이 보장됨
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
      onComplete(newNote);

    } catch (err) {
      console.error("Summarization failed:", err);
      const message = err instanceof Error ? err.message : "요약 중 알 수 없는 오류가 발생했습니다.";
      onError(message);
    }
  };
  
  const updateNote = async (id: string, patch: Partial<Note>) => {
    await db.notes.update(id, { ...patch, updatedAt: new Date().getTime() });
  };

  const deleteNote = async (id: string) => {
    await db.notes.delete(id);
  };

  const getNote = useCallback(async (id: string): Promise<Note | undefined> => {
    return await db.notes.get(id);
  }, []);

  // GEMINI: 가져온 노트를 DB에 추가하는 함수
  const importNote = async (note: Partial<Note>) => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: note.title || '제목 없음',
      content: note.content || '',
      key_insights: note.key_insights || [],
      tag: note.tag || '일반',
      sourceUrl: note.sourceUrl,
      sourceType: note.sourceType || 'other',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().getTime(),
      topics: note.topics || [],
      labels: note.labels || [],
      highlights: note.highlights || [],
      todo: note.todo || [],
      favorite: note.favorite || false,
      attachments: note.attachments || [],
    };
    await db.notes.add(newNote);
    return newNote;
  };

  return { notes: notes || [], loading, filters, setFilters, toggleFavorite, addNote, updateNote, deleteNote, getNote, importNote };
}