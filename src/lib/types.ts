// Using 'as const' provides stronger type safety and enables auto-completion.
export const SOURCE_TYPES = ['youtube', 'book', 'web', 'other'] as const;
export type SourceType = typeof SOURCE_TYPES[number]; // 'youtube' | 'book' | 'web' | 'other'

export const THEMES = ['light', 'dark'] as const;
export type Theme = typeof THEMES[number]; // 'light' | 'dark'

// GEMINI: 첨부파일 타입을 정의합니다.
export type FileAttachment = {
  id: string;
  type: 'file';
  name: string;
  mimeType: string;
  data: Blob;
};

export type LinkAttachment = {
  id: string;
  type: 'link';
  url: string;
};

export type Attachment = FileAttachment | LinkAttachment;


/**
 * Represents a single note entry in the database.
 */
export interface Note {
  id: string;
  title: string;       // (수정) Gemini가 생성
  content: string;     // (수정) Gemini가 생성한 요약문 (summary)
  sourceType: SourceType;
  sourceUrl?: string | null;
  thumbnailUrl?: string | null; // GEMINI: 유튜브 썸네일 URL 필드 추가
  createdAt: string;
  updatedAt: number; // updatedAt은 number 타입 유지
  tag: string;         // (대체) Gemini가 생성한 단일 태그
  key_insights: string[]; // (신규) Gemini가 생성한 핵심 인사이트
  topics: string[];    // (삭제 예정 또는 레거시 데이터용으로 유지)
  labels: string[];
  highlights: { text: string; index: number }[];
  todo: { text: string; done: boolean }[];
  favorite: boolean;
  attachments?: Attachment[];
}

/**
 * Defines the structure for topic classification rules.
 * It's a record where each key is a topic name (string)
 * and the value is an array of associated keywords (string[]).
 */
export interface TopicRule {
  topic: string;
  keywords: string[];
}

/**
 * Represents the application's settings structure.
 */
export interface AppSettings {
  topicRules: TopicRule;
  theme: Theme;
  defaultTopics: string[];
}

// --- API 데이터 타입 ---

export interface SummaryData {
  summary: string;
  key_insights: string[];
}

export interface TaggingData {
  title: string;
  tag: string; // API는 tag 하나만 반환하지만, 우리 시스템은 topics 배열을 사용합니다.
}

