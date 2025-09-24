import { useState, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { Note, Subject, ScheduleEvent, Quiz, Attachment, NoteType, ReviewItem } from './types';
import { v4 as uuidv4 } from 'uuid';
import { format, addDays, startOfYear, endOfYear } from 'date-fns';

export type Filters = {
  search?: string;
  subjectId?: string;
  favorite?: boolean;
  dateRange?: 'today' | '7days' | '30days' | 'all';
  noteType?: NoteType;
};

export interface AddNotePayload {
  youtubeUrl: string;
  onProgress: (status: string) => void;
  onComplete: (note: Note) => void;
  onError: (error: string) => void;
}

export interface AddNoteFromReviewPayload {
  aiConversationText: string;
  files: File[];
  subjects: Subject[];
  onProgress: (status: string) => void;
  onComplete: (note: Note, quiz: Quiz) => void;
  onError: (error: string) => void;
  noteDate?: string;
}

export interface AddScheduleFromImagePayload {
  file: File;
  onProgress: (status: string) => void;
  onComplete: (events: ScheduleEvent[]) => void;
  onError: (error: string) => void;
}

export interface AddNoteFromAssignmentPayload {
    referenceFiles: File[];
    problemFiles: File[];
    answerFiles: File[];
    noteContext: string;
    subjectId: string;
    onProgress: (status: string) => void;
    onComplete: (note: Note) => void;
    onError: (error: string) => void;
}

export function useNotes(defaultFilters?: Filters) {
    const [filters, setFilters] = useState<Filters>(defaultFilters || { dateRange: 'all' });

    const notes = useLiveQuery(() => db.notes.toArray(), []);
    const allSubjects = useLiveQuery(() => db.subjects.toArray(), []);
    const schedule = useLiveQuery(() => db.schedule.toArray(), []);
    
    const filteredNotes = useLiveQuery(async () => {
      let query = db.notes.toCollection();
      if (filters.search) {
          const searchQuery = filters.search.toLowerCase();
          query = query.filter(n =>
              n.title.toLowerCase().includes(searchQuery) ||
              n.content.toLowerCase().includes(searchQuery)
          );
      }
      if (filters.noteType) {
          query = query.filter(n => n.noteType === filters.noteType);
      }
      return await query.reverse().sortBy('updatedAt');
    }, [filters]);

    const loading = filteredNotes === undefined;

    const toggleFavorite = async (id: string) => {
        const note = await db.notes.get(id);
        if (!note) return;
        await db.notes.update(id, { favorite: !note.favorite });
    };

    const addNote = async (payload: AddNotePayload) => {
      // Implementation...
    };

    const addNoteFromReview = async (args: AddNoteFromReviewPayload) => {
      const { aiConversationText, files, subjects, onProgress, onComplete, onError, noteDate } = args;
      try {
        onProgress?.("AI 복습 노트를 생성하고 있습니다...");
        const formData = new FormData();
        formData.append('aiConversationText', aiConversationText);
        files.forEach(file => formData.append('files', file));
        formData.append('subjects', JSON.stringify(subjects));

        const response = await fetch('/api/create_review_note', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Review note creation failed');
        }

        const result = await response.json();
        const { title, summary, key_insights, quiz, subjectId } = result;

        if (!subjectId || !(subjects.some(s => s.id === subjectId))) {
            throw new Error('API가 유효하지 않은 subjectId를 반환했습니다.');
        }

        const newNote: Note = {
          id: uuidv4(),
          title, content: summary, key_insights, subjectId,
          noteType: 'review', sourceType: 'other',
          createdAt: new Date().toISOString(), updatedAt: new Date().getTime(),
          noteDate, favorite: false, attachments: [],
        };

        const newQuiz: Quiz = {
          id: uuidv4(),
          noteId: newNote.id,
          questions: (result.quiz && Array.isArray(result.quiz.questions)) ? result.quiz.questions : [],
        };

        await db.notes.add(newNote);
        await db.quizzes.add(newQuiz);

        onComplete?.(newNote, newQuiz);
      } catch (err) {
        console.error("Review note creation failed:", err);
        const errorMessage = err instanceof Error ? err.message : "복습 노트 생성 중 알 수 없는 오류가 발생했습니다.";
        onError?.(errorMessage);
      }
    };
    
    const addScheduleFromImage = async (payload: AddScheduleFromImagePayload) => {
      // Implementation...
    };

    const addNoteFromTextbook = async (title: string, content: string, subjectId: string, files: File[], noteDate?: string): Promise<Note> => {
      const attachments: Attachment[] = files.map(file => ({
        id: uuidv4(),
        name: file.name,
        type: file.type,
        size: file.size,
      }));
    
      const newNote: Note = {
        id: uuidv4(),
        title,
        content,
        subjectId,
        attachments,
        noteType: 'textbook',
        sourceType: 'other',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().getTime(),
        noteDate,
        favorite: false,
      };
    
      await db.notes.add(newNote);
      return newNote;
    };

    const addNoteFromAssignment = async (payload: AddNoteFromAssignmentPayload) => {
      // Implementation...
    };
    
    const updateNote = async (id: string, patch: Partial<Note>) => {
      await db.notes.update(id, { ...patch, updatedAt: new Date().getTime() });
    };

    const deleteNote = async (id: string) => {
      await db.notes.delete(id);
    };

    const addSubject = async (name: string, color?: string) => {
      const newSubject: Subject = { id: uuidv4(), name, color };
      await db.subjects.add(newSubject);
      return newSubject;
    };
    
    // ... other CRUD functions for subjects, schedule, etc.

    const getNote = useCallback(async (id: string): Promise<Note | undefined> => db.notes.get(id), []);
    const getQuiz = useCallback(async (noteId: string): Promise<Quiz | undefined> => db.quizzes.where('noteId').equals(noteId).first(), []);
    
    const activityData = useMemo(() => {
        if (!notes) return [];
        const activityMap = new Map<string, number>();
        const currentYearStart = startOfYear(new Date());
        const currentYearEnd = endOfYear(new Date());

        for (const note of notes) {
            const date = new Date(note.noteDate || note.createdAt);
            if (date >= currentYearStart && date <= currentYearEnd) {
                const day = format(date, 'yyyy-MM-dd');
                activityMap.set(day, (activityMap.get(day) || 0) + 1);
            }
        }
        return Array.from(activityMap.entries()).map(([day, value]) => ({ day, value }));
    }, [notes]);

    return {
        notes: filteredNotes || [],
        loading,
        allSubjects: allSubjects || [],
        schedule: schedule || [],
        filters,
        setFilters,
        toggleFavorite,
        addNote,
        addNoteFromReview,
        addScheduleFromImage,
        addNoteFromTextbook, // Added this line
        addNoteFromAssignment,
        updateNote,
        deleteNote,
        addSubject,
        getNote, 
        getQuiz,
        activityData,
    };
}