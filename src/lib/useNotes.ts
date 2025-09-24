import { useState, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { Note, Subject, ScheduleEvent, Quiz, Attachment, NoteType, ReviewItem } from './types';
import { v4 as uuidv4 } from 'uuid';
import { format, addDays, startOfYear, endOfYear, startOfToday, endOfToday } from 'date-fns';

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
    const [filters, setFilters] = useState<Filters>(defaultFilters || {});

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
        onProgress?.("파일 업로드 및 변환 중...");
        let jobId = null;

        if (files.length > 0) {
            const uploadFormData = new FormData();
            files.forEach(file => uploadFormData.append('files', file));
    
            const uploadResponse = await fetch('/api/upload_and_convert', { 
              method: 'POST', 
              body: uploadFormData 
            });
    
            if (!uploadResponse.ok) {
              const errorData = await uploadResponse.json();
              throw new Error(errorData.error || '파일 업로드 및 변환에 실패했습니다.');
            }
            const uploadResult = await uploadResponse.json();
            jobId = uploadResult.jobId;
        }

        onProgress?.("AI 복습 노트를 생성하고 있습니다...");
        const reviewNoteBody = {
          jobId,
          aiConversationText,
          subjects,
          noteDate
        };

        const response = await fetch('/api/create_review_note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reviewNoteBody),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || errorData.error || 'Review note creation failed');
        }

        const result = await response.json();
        const { title, summary, key_insights, quiz, subjectId } = result;

        if (!subjectId || !(subjects.some(s => s.id === subjectId))) {
            throw new Error(`API가 유효하지 않은 subjectId ('${subjectId}')를 반환했습니다. 사용 가능한 ID: ${subjects.map(s => s.id).join(', ')}`);
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
      const attachments: Attachment[] = await Promise.all(files.map(async (file) => ({
        id: uuidv4(),
        type: 'file',
        name: file.name,
        mimeType: file.type,
        data: file,
      })));
    
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
        key_insights: [],
      };
    
      await db.notes.add(newNote);
      return newNote;
    };

    const addNoteFromAssignment = async (payload: { title: string, content: string, subjectId: string }): Promise<Note> => {
      const { title, content, subjectId } = payload;
      const newNote: Note = {
        id: uuidv4(),
        title,
        content,
        subjectId,
        noteType: 'assignment',
        sourceType: 'other',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().getTime(),
        favorite: false,
        attachments: [],
        key_insights: [],
      };
      await db.notes.add(newNote);
      return newNote;
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

    const updateSubject = async (id: string, name: string, color?: string) => {
      await db.subjects.update(id, { name, color });
    };

    const deleteSubject = async (id: string) => {
      await db.subjects.delete(id);
      // Also consider what to do with notes associated with this subject
    };

    const importNote = async (noteData: Partial<Note>) => {
        const newNote: Note = {
            id: uuidv4(),
            title: noteData.title || '제목 없음',
            content: noteData.content || '',
            noteType: noteData.noteType || 'general',
            sourceType: noteData.sourceType || 'other',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().getTime(),
            favorite: false,
            ...noteData,
        };
        await db.notes.add(newNote);
        return newNote;
    };
    
    // ... other CRUD functions for subjects, schedule, etc.

    const getNote = useCallback(async (id: string): Promise<Note | undefined> => db.notes.get(id), []);
    const getQuiz = useCallback(async (noteId: string): Promise<Quiz | undefined> => db.quizzes.where('noteId').equals(noteId).first(), []);

    const todaysReviewItems = useLiveQuery(async () => {
        const todayStart = startOfToday().getTime();
        return db.reviewItems.where('nextReviewDate').belowOrEqual(todayStart).toArray();
    }, []);

    const addQuizToReviewDeck = async (noteId: string) => {
        const quiz = await getQuiz(noteId);
        if (!quiz) return;

        const newItems = quiz.questions.map(q => ({
            id: uuidv4(),
            noteId: noteId,
            question: q.question,
            options: q.options,
            answer: q.answer,
            lastReviewed: null,
            nextReviewDate: new Date().getTime(),
            interval: 1,
        }));
        await db.reviewItems.bulkAdd(newItems);
    };

    const updateReviewItem = async (itemId: string, wasCorrect: boolean) => {
        const item = await db.reviewItems.get(itemId);
        if (!item) return;
        const newInterval = wasCorrect ? Math.min(item.interval * 2, 60) : 1;
        await db.reviewItems.update(itemId, {
            lastReviewed: new Date().getTime(),
            nextReviewDate: addDays(new Date(), newInterval).getTime(),
            interval: newInterval,
        });
    };

    const deleteReviewItem = async (itemId: string) => {
        await db.reviewItems.delete(itemId);
    };
    
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
        addNoteFromTextbook,
        addNoteFromAssignment,
        updateNote,
        deleteNote,
        addSubject,
        updateSubject,
        deleteSubject,
        getNote, 
        getQuiz,
        importNote,
        todaysReviewItems: todaysReviewItems || [],
        addQuizToReviewDeck,
        updateReviewItem,
        deleteReviewItem,
        activityData,
    };
}