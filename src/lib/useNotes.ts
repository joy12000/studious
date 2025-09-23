import { useState, useCallback } from 'react';
  import { useLiveQuery } from 'dexie-react-hooks';
  import { db } from './db';
import { Note, Subject, ScheduleEvent, Quiz, Attachment, NoteType, ReviewItem } from './types';
import { v4 as uuidv4 } from 'uuid';
import { format, addDays } from 'date-fns';

// ... (기존 타입 정의들은 동일) ...

export function useNotes(defaultFilters?: Filters) {
    const [filters, setFilters] = useState<Filters>(defaultFilters || { dateRange: 'all' });

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

      if (filters.noteType) {
        notesFromDb = notesFromDb.filter(n => n.noteType === filters.noteType);
      }

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

    const addNoteFromReview = async (args: {
      aiConversationText: string;
      files: File[];
      subjects: Subject[];
      onProgress?: (message: string) => void;
      onComplete?: (newNote: Note, newQuiz: Quiz) => void;
      onError?: (error: string) => void;
      noteDate?: string; // ✨ [핵심 추가] noteDate 인자 추가
    }) => {
      const { aiConversationText, files, subjects, onProgress, onComplete, onError, noteDate } = args; // ✨ noteDate 추출
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
          noteDate: noteDate, // ✨ [핵심 추가] 전달받은 noteDate 저장
          favorite: false,
          attachments: [],
        };

      const newQuiz: Quiz = {
        id: crypto.randomUUID(),
        noteId: newNote.id,
          questions: (result.quiz && Array.isArray(result.quiz.questions)) ? result.quiz.questions : [],
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
        onError(message);
      }
    };
    // ✨ [추가] AI 과제 도우미 결과 저장 함수
    const addNoteFromAssignment = async (payload: AddNoteFromAssignmentPayload) => {
        const { referenceFiles, problemFiles, answerFiles, noteContext, subjectId, onProgress, onComplete, onError } = payload;
        
        try {
            onProgress("AI 과제 도우미를 실행 중입니다...");
            const formData = new FormData();
            referenceFiles.forEach(file => formData.append('reference_files', file));
            problemFiles.forEach(file => formData.append('problem_files', file));
            answerFiles.forEach(file => formData.append('answer_files', file));
            formData.append('note_context', noteContext);
            formData.append('subjectId', subjectId);

            const response = await fetch('/api/assignment_helper', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || `서버 오류: ${response.status}`);
            }

            const result = await response.json();

            const newNote: Note = {
                id: uuidv4(),
                title: result.title,
                content: result.content,
                subjectId: result.subjectId,
                noteType: 'assignment', // 노트 타입을 'assignment'로 지정
                sourceType: 'other',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().getTime(),
                noteDate: format(new Date(), 'yyyy-MM-dd'),
                favorite: false,
                key_insights: [], // 과제 도우미는 key_insights를 사용하지 않음
                attachments: [], // 첨부파일은 필요 시 별도 처리
            };

            await db.notes.add(newNote);
            onComplete(newNote);

        } catch (err) {
            console.error("Assignment helper failed:", err);
            const message = err instanceof Error ? err.message : "AI 과제 도우미 실행 중 알 수 없는 오류가 발생했습니다.";
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
        sourceType: 'other',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().getTime(),
        favorite: false,
        attachments: [],
      };
      await db.notes.add(newNote);
      return newNote;
    };

    interface Message {
      id: number;
      text: string;
      sender: 'user' | 'bot';
    }

    // ✨ [핵심 추가] 제목과 컨텍스트만으로 빈 노트를 빠르게 생성하는 함수
    const createEmptyNote = async (
      title: string,
      subjectId: string,
      noteDate: Date
    ): Promise<Note> => {
      
      const newNote: Note = {
        id: uuidv4(),
        title: title.trim(),
        content: `# ${title.trim()}\n\n`, // 제목을 노트 내용의 첫 줄로 추가
        key_insights: [],
        subjectId: subjectId,
        noteType: 'general', // 일반 노트로 생성
        sourceType: 'other',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().getTime(),
        noteDate: format(noteDate, 'yyyy-MM-dd'),
        favorite: false,
        attachments: [],
      };
      
      await db.notes.add(newNote);
      return newNote;
    };

    // ✨ [추가] AI 참고서를 노트로 저장하는 전용 함수
    const addNoteFromTextbook = async (
      title: string,
      content: string,
      subjectId: string,
      files: File[],
      noteDate?: string // ✨ [개선] noteDate 인자 추가
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
        noteDate: noteDate, // ✨ [개선] 전달받은 noteDate 저장
        favorite: false,
        attachments: attachments,
      };
      
      await db.notes.add(newNote);
      return newNote;
    };

    // 🧠 [기능 추가] 복습 덱 관련 함수들
    const todaysReviewItems = useLiveQuery(() => {
        const today = format(new Date(), 'yyyy-MM-dd');
        return db.reviewItems.where('nextReviewDate').belowOrEqual(today).toArray();
    }, []);

    const addQuizToReviewDeck = async (noteId: string) => {
        const quiz = await db.quizzes.where('noteId').equals(noteId).first();
        if (!quiz) {
            alert('이 노트에는 복습할 퀴즈가 없습니다.');
            return;
        }

        const today = format(new Date(), 'yyyy-MM-dd');
        const newItems: ReviewItem[] = quiz.questions.map(q => ({
            id: uuidv4(),
            noteId: noteId,
            question: q.question,
            options: q.options,
            answer: q.answer,
            nextReviewDate: today,
            easeFactor: 2.5,
            interval: 0,
        }));
        
        await db.reviewItems.bulkAdd(newItems);
        alert(`${newItems.length}개의 퀴즈가 복습 덱에 추가되었습니다!`);
    };

    const updateReviewItem = async (itemId: string, wasCorrect: boolean) => {
        const item = await db.reviewItems.get(itemId);
        if (!item) return;

        let newInterval;
        let newEaseFactor = item.easeFactor;

        if (wasCorrect) {
            if (item.interval === 0) {
                newInterval = 1;
            } else {
                newInterval = Math.round(item.interval * newEaseFactor);
            }
            newEaseFactor += 0.1;
        } else {
            newInterval = 1; // 틀리면 다음 날 바로 다시
            newEaseFactor = Math.max(1.3, newEaseFactor - 0.2);
        }
        
        const nextReviewDate = format(addDays(new Date(), newInterval), 'yyyy-MM-dd');
        
        await db.reviewItems.update(itemId, {
            nextReviewDate,
            easeFactor: newEaseFactor,
            interval: newInterval,
        });
    };
    
    const deleteReviewItem = async (itemId: string) => {
        await db.reviewItems.delete(itemId);
    }

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
      addNoteFromAssignment, // ✨ 추가
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
          addNoteFromTextbook,
          createEmptyNote, // ✨ 새로 추가한 함수 반환
      // 🧠 [기능 추가] 복습 덱 관련 데이터와 함수 반환
      todaysReviewItems: todaysReviewItems || [],
      addQuizToReviewDeck,
      updateReviewItem,
      deleteReviewItem
    };
  }