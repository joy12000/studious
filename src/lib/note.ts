// src/lib/note.ts
import { db } from "./db";
import { generateTitle, guessTopics } from "./classify";
import { Note, SourceType } from "./types";

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
