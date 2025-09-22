import { useState, useCallback } from 'react';
  import { useLiveQuery } from 'dexie-react-hooks';
  import { db } from './db';
  import { Note, Subject, ScheduleEvent, Quiz, Attachment } from './types';
  import { v4 as uuidv4 } from 'uuid';
  export type Filters = {
    search?: string;
    subjectId?: string;
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

  export interface AddNoteFromReviewPayload {
    aiConversationText: string;
    files: File[];
    subjects: Subject[];
    onProgress: (status: string) => void;
    onComplete: (note: Note, quiz: Quiz) => void;
    onError: (error: string) => void;
  }

  export interface AddScheduleFromImagePayload {
    file: File;
    onProgress: (status: string) => void;
    onComplete: (events: ScheduleEvent[]) => void;
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

      if (filters.subjectId) {
        notesFromDb = notesFromDb.filter(n => n.subjectId === filters.subjectId);
      }

      if (filters.favorite) {
        notesFromDb = notesFromDb.filter(n => n.favorite);
      }

      return notesFromDb;
    }, [filters]);

    const loading = notes === undefined;

    const allSubjects = useLiveQuery(async () => {
      return await db.subjects.toArray();
    }, []);

    const schedule = useLiveQuery(() => db.schedule.toArray(), []);

    const toggleFavorite = async (id: string) => {
      const note = await db.notes.get(id);
      if (!note) return;
      await db.notes.update(id, { favorite: !note.favorite });
    };

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

        if (!response.ok || !isJson) {
          const errorBody = await response.text();
          throw new Error(`[Debug] 서버 비정상 응답 (상태: ${response.status}): \n\n${errorBody.substring(0, 1000)}`);
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
          subjectId: result.tag, // Assuming tag is subjectId
          noteType: 'general',
          sourceUrl: result.sourceUrl,
          sourceType: 'youtube',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().getTime(),
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

    const addNoteFromReview = async (payload: AddNoteFromReviewPayload) => {
      const { aiConversationText, files, subjects, onProgress, onComplete, onError } = payload;
      try {
        onProgress("AI 복습 노트를 생성하고 있습니다...");
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

        if (!subjectId || !await db.subjects.get(subjectId)) {
            throw new Error('API가 유효하지 않은 subjectId를 반환했습니다.');
        }

        const newNote: Note = {
          id: crypto.randomUUID(),
          title,
          content: summary,
          key_insights,
          subjectId: subjectId, // Use subjectId directly from API
          noteType: 'review',
          sourceType: 'other',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().getTime(),
          favorite: false,
          attachments: [],
        };

        const newQuiz: Quiz = {
          id: crypto.randomUUID(),
          noteId: newNote.id,
          questions: quiz,
        };

        await db.notes.add(newNote);
        await db.quizzes.add(newQuiz);

        onComplete(newNote, newQuiz);
      } catch (err) {
        console.error("Review note creation failed:", err);
        const message = err instanceof Error ? err.message : "복습 노트 생성 중 알 수 없는 오류가 발생했습니다.";
        onError(message);
      }
    };

    const addScheduleFromImage = async (payload: AddScheduleFromImagePayload) => {
      const { file, onProgress, onComplete, onError } = payload;
      try {
        onProgress("시간표 이미지를 분석하고 있습니다...");
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/process_calendar', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Schedule processing failed with status ${response.status}: ${errorBody}`);
        }

        const eventsFromApi: { subjectName: string, startTime: string, endTime: string, dayOfWeek: string }[] = await response.json();

        const newEvents: ScheduleEvent[] = [];
        const subjectsCache: Map<string, Subject> = new Map(allSubjects?.map(s => [s.name, s]));

        const today = new Date();
        const currentDay = today.getDay(); // 0 (Sun) - 6 (Sat)
        const daysToMonday = (currentDay === 0) ? -6 : 1 - currentDay;
        const monday = new Date(today);
        monday.setDate(today.getDate() + daysToMonday);

        const dayOfWeekMap: { [key: string]: number } = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };
        
        for (const event of eventsFromApi) {
          if (!event.subjectName) {
            console.warn(`Event from API is missing subjectName, skipping.`);
            continue;
          }

          let subject = subjectsCache.get(event.subjectName);
          if (!subject) {
            onProgress(`새로운 과목 '${event.subjectName}'을 추가합니다...`);
            subject = await addSubject(event.subjectName);
            subjectsCache.set(subject.name, subject);
          }
          const subjectId = subject.id;

          const dayOffset = dayOfWeekMap[event.dayOfWeek];
          if (dayOffset === undefined) {
            console.warn(`Invalid dayOfWeek '${event.dayOfWeek}' from API, skipping event.`);
            continue;
          }
          const eventDate = new Date(monday);
          eventDate.setDate(monday.getDate() + dayOffset);
          
          const dateString = eventDate.toISOString().split('T')[0]; // "YYYY-MM-DD"

          newEvents.push({
            id: crypto.randomUUID(),
            subjectId: subjectId,
            date: dateString,
            startTime: event.startTime,
            endTime: event.endTime,
            dayOfWeek: event.dayOfWeek,
          });
        }

        await db.schedule.bulkAdd(newEvents);
        onComplete(newEvents);

      } catch (err) {
        console.error("Schedule processing failed:", err);
        const message = err instanceof Error ? err.message : "시간표 처리 중 알 수 없는 오류가 발생했습니다.";
        onError(message);
      }
    };

    const updateNote = async (id: string, patch: Partial<Note>) => {
      await db.notes.update(id, { ...patch, updatedAt: new Date().getTime() });
    };

    const deleteNote = async (id: string) => {
      await db.notes.delete(id);
    };

    const addSubject = async (name: string, color?: string) => {
      const newSubject: Subject = { id: crypto.randomUUID(), name, color };
      await db.subjects.add(newSubject);
      return newSubject;
    };

    const updateSubject = async (id: string, name: string, color?: string) => {
      await db.subjects.update(id, { name, color });
    };

    const deleteSubject = async (id: string) => {
      await db.subjects.delete(id);
    };

    const addScheduleEvent = async (event: Omit<ScheduleEvent, 'id'>) => {
      const newEvent = { ...event, id: crypto.randomUUID() };
      await db.schedule.add(newEvent);
      return newEvent;
    };

    const updateScheduleEvent = async (id: string, event: Partial<ScheduleEvent>) => {
      await db.schedule.update(id, event);
    };

    const deleteScheduleEvent = async (id: string) => {
      await db.schedule.delete(id);
    };

      const getNote = useCallback(async (id: string): Promise<Note | undefined> => {
        return await db.notes.get(id);
      }, []);
    
      const getQuiz = useCallback(async (noteId: string): Promise<Quiz | undefined> => {
        return await db.quizzes.where('noteId').equals(noteId).first();
      }, []);
    const importNote = async (note: Partial<Note>) => {
      const newNote: Note = {
        id: crypto.randomUUID(),
        title: note.title || '제목 없음',
        content: note.content || '',
        key_insights: note.key_insights || [],
        subjectId: note.subjectId || '일반',
        noteType: note.noteType || 'general',
        sourceUrl: note.sourceUrl,
        sourceType: note.sourceType || 'other',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().getTime(),
        favorite: note.favorite || false,
        attachments: note.attachments || [],
      };
      await db.notes.add(newNote);
      return newNote;
    };

    interface Message {
      id: number;
      text: string;
      sender: 'user' | 'bot';
    }

    // ✨ [개선] addNoteFromChat 함수에 files 인자 추가
    const addNoteFromChat = async (messages: Message[], title?: string, files: File[] = []) => {
      const content = messages
        .map(msg => `**${msg.sender === 'user' ? '나' : 'AI'}**: \n\n${msg.text}`)
        .join('\n\n---\n\n');

      // ✨ [추가] File 객체를 Attachment 타입으로 변환
      const attachments: Attachment[] = files.map(file => ({
        id: uuidv4(),
        type: 'file',
        name: file.name,
        mimeType: file.type,
        data: file,
      }));

      const newNote: Note = {
        id: uuidv4(),
        title: title || `AI 채팅 기록: ${new Date().toLocaleString()}`,
        content: content,
        key_insights: [],
        subjectId: 'AI 채팅',
        noteType: 'general',
        sourceType: 'other',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().getTime(),
        favorite: false,
        attachments: attachments, // ✨ [개선] 변환된 첨부파일 저장
      };
      
      await db.notes.add(newNote);
      return newNote;
    };

    // ✨ [추가] AI 참고서를 노트로 저장하는 전용 함수
    const addNoteFromTextbook = async (
      title: string,
      content: string,
      subjectId: string,
      files: File[]
    ): Promise<Note> => {
      
      const attachments: Attachment[] = files.map(file => ({
        id: uuidv4(),
        type: 'file',
        name: file.name,
        mimeType: file.type,
        data: file,
      }));

      const newNote: Note = {
        id: uuidv4(),
        title: title,
        content: content,
        key_insights: [], // 참고서 생성 시에는 key_insights를 AI 프롬프트에서 직접 생성하도록 유도할 수 있습니다.
        subjectId: subjectId,
        // ✨ [핵심 수정] 노트 타입을 'textbook'으로 명확하게 지정
        noteType: 'textbook', 
        sourceType: 'other',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().getTime(),
        favorite: false,
        attachments: attachments,
      };
      
      await db.notes.add(newNote);
      return newNote;
    };

    return {
      notes: notes || [],
      loading,
      allSubjects: allSubjects || [],
      schedule: schedule || [],
      filters,
      setFilters,
      toggleFavorite,
      addNote,
      addNoteFromReview,
      addScheduleFromImage,
      updateNote,
      deleteNote,
      addSubject,
      updateSubject,
      deleteSubject,
      addScheduleEvent,
      updateScheduleEvent,
      deleteScheduleEvent,
          getNote, 
          getQuiz,
          importNote,
          addNoteFromChat,
          addNoteFromTextbook
    };
  }