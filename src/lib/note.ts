// src/lib/note.ts
import { db } from "./db";
import { generateTitle, guessTopics } from "./classify";
import { Note, SourceType, Attachment } from "./types"; // GEMINI: Attachment 타입 임포트
import { encryptJSON } from './crypto';

// GEMINI: CreateNotePayload에 attachments 필드 추가
export interface CreateNotePayload {
  content: string;
  title?: string;
  sourceUrl?: string | null;
  sourceType?: SourceType;
  attachments?: Attachment[];
}

// GEMINI: HTML에서 순수 텍스트를 추출하는 헬퍼 함수
function extractTextFromHTML(html: string): string {
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
}

/**
 * Creates a new note, generates metadata, and saves it to the database.
 * @param payload The data for the new note.
 * @returns The newly created Note object.
 */
export async function createNote(payload: CreateNotePayload): Promise<Note> {
  // GEMINI: payload에서 attachments 추출
  const { content, title: titleFromUser, sourceUrl, sourceType: typeFromUser, attachments } = payload;

  if (!content || !content.trim()) {
    // GEMINI: 내용이 없어도 첨부파일이 있으면 생성 가능하도록 변경
    if (!attachments || attachments.length === 0) {
      throw new Error("Content and attachments cannot both be empty.");
    }
  }

  // ... (유튜브 링크 추출 로직은 변경 없음) ...
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
  let tempContent = content; // 원본 content는 보존
  let extractedUrl: string | null = null;
  const matches = tempContent.match(youtubeRegex);
  if (matches && matches.length > 0) {
    extractedUrl = matches[0];
    // 링크 제거는 텍스트 분석용으로만 사용
    tempContent = tempContent.replace(youtubeRegex, '').trim();
  }

  const finalSourceUrl = extractedUrl || (sourceUrl ? String(sourceUrl).trim() : null);
  let finalSourceType: SourceType = 'other';

  if (finalSourceUrl) {
    if (typeFromUser) {
      finalSourceType = typeFromUser;
    } 
    else if (extractedUrl || finalSourceUrl.includes('youtube.com') || finalSourceUrl.includes('youtu.be')) {
      finalSourceType = 'youtube';
    } else {
      finalSourceType = 'web';
    }
  }

  // GEMINI: 텍스트 분석은 HTML을 제거한 순수 텍스트로 수행
  const textForAnalysis = extractTextFromHTML(tempContent);

  const id = crypto.randomUUID();
  // GEMINI: 내용이 비어있을 경우 "첨부파일 노트"와 같은 기본 제목을 사용
  const title = (titleFromUser || await generateTitle(textForAnalysis) || "첨부파일 노트").trim();
  const topics = await guessTopics(textForAnalysis);
  const now = new Date().toISOString();

  const newNote: Note = {
    id,
    title,
    content: content, // GEMINI: 원본 HTML 콘텐츠를 그대로 저장
    sourceUrl: finalSourceUrl,
    sourceType: finalSourceType,
    createdAt: now,
    topics,
    labels: [],
    highlights: [],
    todo: [],
    favorite: false,
    // GEMINI: attachments 필드 추가
    attachments: attachments || [],
  };

  await db.notes.add(newNote);
  return newNote;
}

// ... (shareNote, downloadEncryptedNote 함수는 변경 없음) ...
/**
 * Encrypts a note and shares it as a file.
 * @param note The note to share.
 * @param passphrase The 4-digit PIN to encrypt the note.
 */
export async function shareNote(note: Note, passphrase: string): Promise<void> {
  const fallbackShare = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    alert(`자동 공유가 지원되지 않아 수동 다운로드를 시작합니다.\n\n브라우저에서 다운로드 진행 상황을 확인하고, 설정한 비밀번호 "${passphrase}"를 파일과 함께 전달해주세요.`);
  };

  try {
    const payload = await encryptJSON({
      title: note.title, content: note.content, topics: note.topics, 
      labels: note.labels, sourceUrl: note.sourceUrl, sourceType: note.sourceType 
    }, passphrase);
    
    const file = new File([JSON.stringify(payload, null, 2)], `${note.title.replace(/[/:*?"<>|]/g, '')}.txt`, { type: 'text/plain' });

    if (navigator.share && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
        });
        alert(`공유가 시작되었습니다. 설정한 비밀번호 "${passphrase}"를 상대방에게 알려주세요.`);
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'NotAllowedError') {
          fallbackShare(file);
        } else { throw error; }
      }
    } else {
      fallbackShare(file);
    }
  } catch (error) {
    console.error('노트 공유 실패:', error);
    alert('노트를 공유하는 데 실패했습니다.');
  }
}

/**
 * Encrypts and downloads a note as an .aibook file.
 * @param note The note to download.
 * @param passphrase The 4-digit PIN to encrypt the note.
 */
export async function downloadEncryptedNote(note: Note, passphrase: string): Promise<void> {
  try {
    const payload = await encryptJSON({
      title: note.title,
      content: note.content,
      topics: note.topics,
      labels: note.labels,
      sourceUrl: note.sourceUrl,
      sourceType: note.sourceType,
    }, passphrase);

    const file = new File(
      [JSON.stringify(payload, null, 2)],
      `${note.title.replace(/[\\/:*?"<>|]/g, '')}.aibook`,
      { type: 'text/plain' }
    );

    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.error('암호화된 노트 다운로드 실패:', error);
    alert('암호화된 노트를 다운로드하는 데 실패했습니다.');
  }
}