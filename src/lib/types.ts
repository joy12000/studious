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
  id:string;
  title: string;
  content: string;
  sourceType: SourceType;
  sourceUrl?: string | null;
  createdAt: string;
  topics: string[];
  labels: string[];
  highlights: { text: string; index: number }[];
  todo: { text: string; done: boolean }[];
  favorite: boolean;
  // GEMINI: 노트에 첨부파일 필드를 추가합니다.
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
