// src/lib/note.ts
import { db } from "./db";
import { generateTitle, guessTopics } from "./classify";
import { Note, SourceType } from "./types";
import { encryptJSON } from './crypto';

export interface CreateNotePayload {
  content: string;
  title?: string;
  sourceUrl?: string | null;
  sourceType?: SourceType;
}

/**
 * Creates a new note, generates metadata, and saves it to the database.
 * @param payload The data for the new note.
 * @returns The newly created Note object.
 */
export async function createNote(payload: CreateNotePayload): Promise<Note> {
  const { content, title: titleFromUser, sourceUrl, sourceType: typeFromUser } = payload;

  if (!content || !content.trim()) {
    throw new Error("Content cannot be empty.");
  }

  // YOUTUBE_LINK_EXTRACTION: 유튜브 링크 추출 및 처리 로직 시작
  // 유튜브 URL을 찾기 위한 정규식입니다. (standard, short, shorts, live, embed)
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
  
  let cleanedContent = content;
  let extractedUrl: string | null = null;
  
  // 본문에서 모든 유튜브 링크를 찾습니다.
  const matches = content.match(youtubeRegex);
  
  if (matches && matches.length > 0) {
    // "첫 번째 링크 우선" 정책에 따라 첫 번째 링크를 대표 URL로 사용합니다.
    extractedUrl = matches[0];
    // 본문에서 모든 유튜브 링크를 제거하여 내용을 정리합니다.
    cleanedContent = content.replace(youtubeRegex, '').trim();
  }
  // YOUTUBE_LINK_EXTRACTION: 로직 종료

  // 소스 URL과 타입을 결정합니다. 본문에서 추출된 링크가 우선권을 가집니다.
  const finalSourceUrl = extractedUrl || (sourceUrl ? String(sourceUrl).trim() : null);
  let finalSourceType: SourceType = 'other';

  if (finalSourceUrl) {
    // 사용자가 직접 타입을 지정한 경우 해당 타입을 사용합니다.
    if (typeFromUser) {
      finalSourceType = typeFromUser;
    } 
    // 그렇지 않으면 URL을 분석하여 타입을 자동으로 결정합니다.
    else if (extractedUrl || finalSourceUrl.includes('youtube.com') || finalSourceUrl.includes('youtu.be')) {
      finalSourceType = 'youtube';
    } else {
      finalSourceType = 'web';
    }
  }

  const id = crypto.randomUUID();
  // 제목은 링크가 제거된 내용을 기반으로 생성합니다.
  const title = (titleFromUser || await generateTitle(cleanedContent)).trim();
  // 토픽 또한 링크가 제거된 내용을 기반으로 추측합니다.
  const topics = await guessTopics(cleanedContent);
  const now = new Date().toISOString();

  const newNote: Note = {
    id,
    title,
    // content는 링크가 제거된 버전으로 저장합니다.
    content: cleanedContent,
    sourceUrl: finalSourceUrl,
    sourceType: finalSourceType,
    createdAt: now,
    topics,
    labels: [],
    highlights: [],
    todo: [],
    favorite: false,
  };

  await db.notes.add(newNote);
  return newNote;
}

/**
 * Encrypts a note and shares it as a file.
 * @param note The note to share.
 * @param passphrase The 4-digit PIN to encrypt the note.
 */
export async function shareNote(note: Note, passphrase: string): Promise<void> {
  const fallbackShare = (file: File) => {
    alert('자동 공유가 지원되지 않거나 차단되었습니다. 파일을 수동으로 다운로드합니다.');
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert(`파일이 다운로드되었습니다. 설정한 비밀번호 "${passphrase}"를 기억하여 전달해주세요.`);
  };

  try {
    const payload = await encryptJSON({
      title: note.title, content: note.content, topics: note.topics, 
      labels: note.labels, sourceUrl: note.sourceUrl, sourceType: note.sourceType 
    }, passphrase);
    
    const file = new File([JSON.stringify(payload, null, 2)], `${note.title.replace(/[\\/:\"*?<>|]/g, '')}.json`, { type: 'application/json' });

    if (navigator.share && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `암호화된 노트: ${note.title}`,
          text: `이 파일을 열려면 비밀번호가 필요합니다.`, 
          files: [file],
        });
        alert(`공유가 시작되었습니다. 설정한 비밀번호 "${passphrase}"를 상대방에게 알려주세요.`);
      } catch (error: any) {
        if (error.name === 'NotAllowedError') {
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
