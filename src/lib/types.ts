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


// 신규 타입 추가export interface Subject {
  id: string;
  name: string;
  color?: string; // 과목별 색상 지정을 위한 선택적 필드
}export interface ScheduleEvent {
  id: string;
  subjectId: string; // Subject의 id와 연결
  date: string;      // "YYYY-MM-DD" 형식
  startTime: string; // ISO 8601 형식
  endTime: string;   // ISO 8601 형식
  dayOfWeek: string; // 요일
}export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
}export interface Quiz {
  id: string;
  noteId: string; // Note의 id와 연결
  questions: QuizQuestion[];
}// 기존 Note 타입 확장export interface Note {
  id: string;
  title: string;
  content: string;
  noteType: 'general' | 'review' | 'textbook'; // 노트 타입 추가
  subjectId?: string; // subject의 id와 연결 (기존 tag 대체)
  sourceType: SourceType;
  sourceUrl?: string | null;
  createdAt: string;
  updatedAt: number;
  key_insights: string[];
  favorite: boolean;
  attachments?: Attachment[];
  // 기존의 tag, topics, labels 등은 레거시 데이터 호환을 위해 유지하거나 마이그레이션 과정에서 제거
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
