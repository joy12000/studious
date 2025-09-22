import Dexie, { Table } from 'dexie';
import { Note, AppSettings, TopicRule, Subject, ScheduleEvent, Quiz } from './types';


class AppDB extends Dexie {
  notes!: Table<Note, string>;
  subjects!: Table<Subject, string>;     // 신규
  schedule!: Table<ScheduleEvent, string>; // 신규
  quizzes!: Table<Quiz, string>;         // 신규
  settings!: Table<AppSettings & { id: string }, string>;
  topicRules!: Table<TopicRule, number>; // GEMINI: 기본 키를 숫자로 변경

  constructor() {
    super('selfdev-db');
    this.setupSchema();
  }

  private setupSchema() {
    // 여러 버전으로 흩어져 있던 스키마 정의를 최신 버전으로 통합하여
    // 버전 업데이트 시 테이블이 삭제되는 치명적인 버그를 수정합니다.
    this.version(5).stores({
      // notes 테이블: 모든 인덱스를 최신 기준으로 통합
      notes: 'id, createdAt, noteType, subjectId, favorite, sourceType, attachments',
      
      // subjects 테이블
      subjects: '&id, name',
      
      // schedule 테이블: date 인덱스 포함
      schedule: '&id, date, startTime, endTime, subjectId, dayOfWeek',
      
      // quizzes 테이블
      quizzes: '&id, noteId',
      
      // settings 테이블
      settings: 'id',
      
      // topicRules 테이블
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
