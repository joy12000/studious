export interface Note {
  id: string;
  content: string;
  topics: string[];
  favorite: boolean;
  createdAt: number; // epoch ms
  sourceType?: 'manual' | 'share';
  title?: string;
  todo?: { text: string; done: boolean }[];
}

export interface AppSettings {
  id?: string;
  theme: 'light' | 'dark';
  topicRules: Record<string, string[]>;
  defaultTopics: string[];
}
