// src/lib/types.ts

export const SOURCE_TYPES = ['youtube', 'book', 'web', 'other'] as const;
export type SourceType = typeof SOURCE_TYPES[number];

export const THEMES = ['light', 'dark'] as const;
export type Theme = typeof THEMES[number];

export type NoteType = 'general' | 'review' | 'textbook' | 'assignment' | 'lecture';

export type FileAttachment = {
  id: string;
  type: 'file';
  name: string;
  mimeType: string;
  data: ArrayBuffer;
};

export type LinkAttachment = {
  id: string;
  type: 'link';
  url: string;
};

export type Attachment = FileAttachment | LinkAttachment;

export interface Subject {
  id: string;
  name: string;
  color?: string;
}

export interface Folder {
  id: string;
  name: string;
  subjectId: string;
  parentId?: string; // For future nesting
}

export interface ScheduleEvent {
  id: string;
  subjectId: string;
  date: string;
  startTime: string;
  endTime: string;
  dayOfWeek: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
}

export interface Quiz {
  id: string;
  noteId: string;
  questions: QuizQuestion[];
}

export interface Message {
  id: number;
  type: 'text' | 'thought'; // New field
  content: string; // Renamed from 'text'
  sender: 'user' | 'bot';
  suggestion?: {
    old: string;
    new: string;
  };
  fileUrls?: string[]; // Added for file attachments
}

export interface Note {
  id: string;
  title: string;
  content: string;
  noteType: NoteType;
  subjectId?: string;
  folderId?: string; // Added for folder structure
  sourceType: SourceType;
  sourceUrl?: string | null;
  createdAt: string;
  updatedAt: number;
  noteDate?: string;
  key_insights: string[];
  favorite: boolean;
  attachments?: Attachment[];
  chatHistory?: Message[]; // Added chatHistory
  is_deleted?: boolean; // For soft-delete sync
}

// 🧠 [기능 추가] 복습 덱 아이템 타입
export interface ReviewItem {
    id: string;
    noteId: string;
    question: string;
    options: string[];
    answer: string;
    nextReviewDate: string; // "YYYY-MM-DD"
    easeFactor: number; // 1.3 (어려움) ~ 2.5 (쉬움)
    interval: number; // 다음 복습까지의 일수
}

export interface TopicRule {
  topic: string;
  keywords: string[];
}

export interface AppSettings {
  topicRules: TopicRule;
  theme: Theme;
  defaultTopics: string[];
  semesterStartDate?: string;
}

export interface ExportedData {
  version: 1;
  exportedAt: number;
  notes: Note[];
  settings: (AppSettings & { id: string })[];
};