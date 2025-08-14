export interface Note {
  id: string;
  title: string;
  content: string;
  sourceType: 'youtube' | 'book' | 'web' | 'other';
  sourceUrl?: string | null;
  createdAt: string;
  topics: string[];
  labels: string[];
  highlights: { text: string; index: number }[];
  todo: { text: string; done: boolean }[];
  favorite: boolean;
}

export interface TopicRule {
  [key: string]: string[];
}

export interface AppSettings {
  topicRules: TopicRule;
  theme: 'light' | 'dark';
  defaultTopics: string[];
}