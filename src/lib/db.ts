import Dexie, { Table } from 'dexie';
import { Note, AppSettings, TopicRule } from './types';
import { DEFAULT_TOPIC_RULES } from './classify'; // Import from classify.ts

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
      // GEMINI: topicRules 테이블을 독립적으로 정의하고 인덱스를 설정합니다.
      // '++id': Auto-incrementing primary key
      // '&topic': Unique index for the topic name
      // '*keywords': Multi-entry index for searching keywords
      topicRules: '++id, &topic, *keywords',
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
        
        // GEMINI: topicRules 테이블에 기본 규칙을 추가합니다.
        console.log('Initializing default topic rules...');
        await this.topicRules.bulkAdd(DEFAULT_TOPIC_RULES);
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
