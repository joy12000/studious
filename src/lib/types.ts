// Using 'as const' provides stronger type safety and enables auto-completion.
export const SOURCE_TYPES = ['youtube', 'book', 'web', 'other'] as const;
export type SourceType = typeof SOURCE_TYPES[number]; // 'youtube' | 'book' | 'web' | 'other'

export const THEMES = ['light', 'dark'] as const;
export type Theme = typeof THEMES[number]; // 'light' | 'dark'

/**
 * Represents a single note entry in the database.
 */
export interface Note {
  id: string;
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
}

/**
 * Defines the structure for topic classification rules.
 * It's a record where each key is a topic name (string)
 * and the value is an array of associated keywords (string[]).
 */
export type TopicRule = Record<string, string[]>;

/**
 * Represents the application's settings structure.
 */
export interface AppSettings {
  topicRules: TopicRule;
  theme: Theme;
  defaultTopics: string[];
}
