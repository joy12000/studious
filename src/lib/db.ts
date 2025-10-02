import Dexie, { Table } from 'dexie';
import { Note, AppSettings, TopicRule, Subject, ScheduleEvent, Quiz, ReviewItem, Folder } from './types'; // Folder 임포트

class AppDB extends Dexie {
  notes!: Table<Note, string>;
  subjects!: Table<Subject, string>;
  folders!: Table<Folder, string>; // folders 테이블 정의
  schedule!: Table<ScheduleEvent, string>;
  quizzes!: Table<Quiz, string>;
  reviewItems!: Table<ReviewItem, string>;
  settings!: Table<AppSettings & { id: string }, string>;
  topicRules!: Table<TopicRule, number>;

  constructor() {
    super('selfdev-db');
    // 스키마 버전업 (-> 7)
    this.version(7).stores({
      notes: 'id, createdAt, noteType, subjectId, folderId, favorite, sourceType, attachments', // notes에 folderId 인덱스 추가
      subjects: '&id, name, color',
      folders: '++id, name, subjectId, parentId', // folders 테이블 스키마 추가
      schedule: '&id, date, startTime, endTime, subjectId, dayOfWeek',
      quizzes: '&id, noteId',
      reviewItems: '&id, noteId, nextReviewDate',
      settings: 'id',
      topicRules: '++id, &topic, *keywords',
    });
  }

  async populateDefaultSettings() {
    await this.transaction('rw', this.settings, this.topicRules, async () => {
      const settingsCount = await this.settings.count();
      if (settingsCount === 0) {
        console.log('Initializing default settings...');
        await this.settings.add({
          id: 'default',
          theme: 'light',
          defaultTopics: ['생산성', '학습', '자기계발', '건강/운동', '경제/금융', '기술/IT', '창작/아이디어', '관계/소통', '문화/취미', '여행', '음식/요리', '일상/쇼핑']
        });
      }
    });
  }
}

const dbInstance = new AppDB();

dbInstance.on('ready', async () => {
  try {
    await dbInstance.populateDefaultSettings();
  } catch (error) {
    console.error("Failed to populate default settings:", error);
  }
});

export const db = dbInstance;
