import { useState, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { Note, Subject, ScheduleEvent, Quiz, Attachment, NoteType, ReviewItem } from './types';
import { v4 as uuidv4 } from 'uuid';
import { format, addDays, startOfYear, endOfYear, startOfToday, endOfToday } from 'date-fns';
import { upload } from '@vercel/blob/client';

// Helper function to generate a random pastel HSL color
const generatePastelColor = (): string => {
  const hue = Math.floor(Math.random() * 360); // 0-360
  const saturation = Math.floor(Math.random() * 20) + 40; // 40-60%
  const lightness = Math.floor(Math.random() * 10) + 70; // 70-80%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

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
      const { youtubeUrl, onProgress, onComplete, onError } = payload;
      
      onProgress?.('YouTube 영상 요약을 시작합니다...');

      try {
        const response = await fetch('/api/summarize_youtube', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ youtube_url: youtubeUrl }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || errorData.error || 'YouTube 요약 중 오류가 발생했습니다.');
        }

        const result = await response.json();
        const { title, content, subject, insights } = result;

        // Find or create subject
        let subjectId = (allSubjects || []).find(s => s.name.toLowerCase() === subject.toLowerCase())?.id;
        if (!subjectId) {
            const newSubject = await addSubject(subject);
            subjectId = newSubject.id;
        }

        const newNote: Note = {
          id: uuidv4(),
          title,
          content,
          subjectId,
          noteType: 'general',
          sourceType: 'youtube',
          sourceUrl: youtubeUrl,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().getTime(),
          favorite: false,
          attachments: [],
          key_insights: insights || [],
        };
    
        await db.notes.add(newNote);
        onComplete?.(newNote);

      } catch (err) {
        console.error("YouTube summarization failed:", err);
        const errorMessage = err instanceof Error ? err.message : "YouTube 영상을 처리하는 중 오류가 발생했습니다.";
        onError?.(errorMessage);
      }
    };

    const addNoteFromReview = async (args: AddNoteFromReviewPayload) => {
      const { aiConversationText, files, subjects, onProgress, onComplete, onError, noteDate } = args;
      try {
        let blobUrls: string[] = [];
        if (files.length > 0) {
            onProgress?.(`파일 ${files.length}개 업로드 중...`);
            const blobResults = await Promise.all(
              files.map(file => 
                upload(file.name, file, {
                  access: 'public',
                  handleUploadUrl: '/api/upload/route',
                })
              )
            );
            blobUrls = blobResults.map(b => b.url);
        }

        onProgress?.("AI 복습 노트를 생성하고 있습니다...");
        const reviewNoteBody = {
          blobUrls,
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
        const { title, content, key_insights, quiz, subjectName: inferredSubjectName } = result; // Get inferredSubjectName

        let subjectId: string | undefined;
        if (inferredSubjectName) {
            let subject = (allSubjects || []).find(s => s.name.toLowerCase() === inferredSubjectName.toLowerCase());
            if (!subject) {
                const newSubject = await addSubject(inferredSubjectName);
                subjectId = newSubject.id;
            } else {
                subjectId = subject.id;
            }
        }

        // If subjectId is still undefined (e.g., no subjectName from API or no matching subject),
        // we can either throw an error or assign a default subjectId.
        // For now, let's throw an error if no subjectId is determined.
        if (!subjectId) {
            throw new Error(`API에서 유효한 과목명을 추론하지 못했거나, 일치하는 과목을 찾을 수 없습니다.`);
        }

        const newNote: Note = {
          id: uuidv4(),
          title, content: content, key_insights, subjectId, // Use the determined subjectId
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
      const { file, onProgress, onComplete, onError } = payload;
      
      onProgress?.('시간표 파일을 서버로 전송 중입니다...');
      
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/api/process_calendar', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || errorData.error || '시간표 처리 중 알 수 없는 오류가 발생했습니다.');
        }

        const eventsFromApi: { subjectName: string, dayOfWeek: string, startTime: string, endTime: string }[] = await response.json();

        onProgress?.('시간표 정보를 처리하고 과목을 동기화하는 중입니다...');

        const eventsForDb: ScheduleEvent[] = [];
        const localSubjects = [...(allSubjects || [])];

        for (const eventFromApi of eventsFromApi) {
          let subject = localSubjects.find(s => s.name === eventFromApi.subjectName);
          if (!subject) {
            const newSubject = await addSubject(eventFromApi.subjectName);
            localSubjects.push(newSubject);
            subject = newSubject;
          }
          
          eventsForDb.push({
            id: uuidv4(),
            subjectId: subject.id,
            dayOfWeek: eventFromApi.dayOfWeek,
            startTime: eventFromApi.startTime,
            endTime: eventFromApi.endTime,
          });
        }

        onProgress?.('시간표 정보를 데이터베이스에 저장 중입니다...');
        
        await db.schedule.clear();
        await db.schedule.bulkPut(eventsForDb);

        onComplete?.(eventsForDb);

      } catch (err) {
        console.error("Schedule import failed:", err);
        const errorMessage = err instanceof Error ? err.message : "시간표를 처리하는 중 오류가 발생했습니다.";
        onError?.(errorMessage);
      }
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

    const saveReviewNote = async (result: any, noteDate: string | undefined, subjects: Subject[]) => {
        const { title, content, key_insights, quiz, subjectId } = result;

        if (!subjectId || !(subjects.some(s => s.id === subjectId))) {
            throw new Error(`API가 유효하지 않은 subjectId ('${subjectId}')를 반환했습니다. 사용 가능한 ID: ${subjects.map(s => s.id).join(', ')}`);
        }

        const newNote: Note = {
          id: uuidv4(),
          title, content: content, key_insights, subjectId,
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
        
        return {newNote, newQuiz};
    };
    
    const updateNote = async (id: string, patch: Partial<Note>) => {
      await db.notes.update(id, { ...patch, updatedAt: new Date().getTime() });
    };

    const deleteNote = async (id: string) => {
      await db.notes.delete(id);
    };

    const addSubject = async (name: string, color?: string) => {
      const subjectColor = color || generatePastelColor();
      const newSubject: Subject = { id: uuidv4(), name, color: subjectColor };
      await db.subjects.add(newSubject);
      return newSubject;
    };

    const updateSubject = async (id: string, name: string, color?: string) => {
      await db.subjects.update(id, { name, color });
    };

    const updateSubjectAndSchedule = async (subjectId: string, scheduleId: string, newName: string, newStartTime: string, newEndTime: string, newDayOfWeek: string) => {
      await db.transaction('rw', db.subjects, db.schedule, async () => {
        await db.subjects.update(subjectId, { name: newName });
        await db.schedule.update(scheduleId, {
          startTime: newStartTime,
          endTime: newEndTime,
          dayOfWeek: newDayOfWeek,
        });
      });
    };

    const deleteSubject = async (id: string) => {
      await db.transaction('rw', db.subjects, db.schedule, db.notes, async () => {
        // 연결된 시간표 항목 삭제
        await db.schedule.where('subjectId').equals(id).delete();
        
        // 연결된 노트들의 subjectId를 null로 설정
        const notesToUpdate = await db.notes.where('subjectId').equals(id).toArray();
        const noteIdsToUpdate = notesToUpdate.map(note => note.id);
        await db.notes.where('id').anyOf(noteIdsToUpdate).modify({ subjectId: null });

        // 과목 자체 삭제
        await db.subjects.delete(id);
      });
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
        updateSubjectAndSchedule, // 추가
        deleteSubject,
        getNote, 
        getQuiz,
        importNote,
        todaysReviewItems: todaysReviewItems || [],
        addQuizToReviewDeck,
        updateReviewItem,
        deleteReviewItem,
        activityData,
        saveReviewNote,
    };
}