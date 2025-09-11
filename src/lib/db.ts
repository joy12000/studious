import Dexie, { Table } from 'dexie';
import { Note, AppSettings, TopicRule } from './types';


class AppDB extends Dexie {
  notes!: Table<Note, string>;
  settings!: Table<AppSettings & { id: string }, string>;
  topicRules!: Table<TopicRule, number>; // GEMINI: 기본 키를 숫자로 변경

  constructor() {
    super('selfdev-db');
    this.setupSchema();
  }

  private setupSchema() {
    this.version(1).stores({
      notes: 'id, createdAt, *topics, favorite, sourceType',
      settings: 'id',
      topicRules: '++id, &topic, *keywords',
    });

    // GEMINI: DB 스키마 버전 2로 업그레이드하고 notes 테이블에 attachments 필드를 추가합니다.
    this.version(2).stores({
      notes: 'id, createdAt, *topics, favorite, sourceType, attachments',
    });

    // 🚀 신규 버전 추가
    this.version(3).stores({
      notes: 'id, createdAt, tag, favorite, sourceType', // topics -> tag 로 인덱스 변경
      // key_insights는 배열이라 직접 인덱싱하지 않음
    });
  }

  /**
   * Populates the database with initial default settings if it's empty.
   * This ensures the app has a valid configuration on first launch.
   */
  async populateDefaultSettings() {
    // GEMINI: settings와 topicRules 테이블을 함께 트랜잭션으로 처리합니다.
    await this.transaction('rw', this.settings, this.topicRules, async () => {
      const settingsCount = await this.settings.count();
      if (settingsCount === 0) {
        console.log('Initializing default settings...');
        // GEMINI: settings 테이블에서 topicRules를 분리합니다.
        await this.settings.add({
          id: 'default',
          theme: 'light',
          defaultTopics: ['생산성', '학습', '자기계발', '건강/운동', '경제/금융', '기술/IT', '창작/아이디어', '관계/소통', '문화/취미', '여행', '음식/요리', '일상/쇼핑']
        });
        
        
      }
    });
  }
}

// Create a singleton instance of the database.
const dbInstance = new AppDB();

// When the database is ready, populate it with default settings.
dbInstance.on('ready', async () => {
  try {
    await dbInstance.populateDefaultSettings();
  } catch (error) {
    console.error("Failed to populate default settings:", error);
  }
});

export const db = dbInstance;
