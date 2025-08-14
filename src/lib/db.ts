import Dexie, { Table } from 'dexie';
import { Note, AppSettings } from './types';

class AppDB extends Dexie {
  notes!: Table<Note, string>;
  settings!: Table<AppSettings & { id: string }, string>;

  constructor() {
    super('selfdev-db');
    this.version(1).stores({
      notes: 'id, createdAt, *topics, favorite, sourceType',
      settings: 'id'
    });

    // Initialize default settings
    this.on('ready', async () => {
      const settingsCount = await this.settings.count();
      if (settingsCount === 0) {
        await this.settings.add({
          id: 'default',
          topicRules: {
            Productivity: ['습관', '루틴', '집중', '시간', '우선순위', '체크리스트', '할 일', '타임블록', '계획', '관리'],
            Learning: ['학습', '공부', '기억', '복습', '필기', '메타인지', '요약', '독서', '지식', '스킬'],
            Mindset: ['마인드', '동기', '자존감', '감정', '회복탄력성', '성장', '사고', '긍정', '마음가짐'],
            Health: ['수면', '식단', '건강', '스트레스', '휴식', '웰빙', '몸', '컨디션'],
            Fitness: ['운동', '웨이트', '러닝', '유산소', '근력', '체력', '트레이닝', '다이어트'],
            Finance: ['투자', '저축', '지출', '예산', '수입', '재무', '파이낸스', '돈', '경제'],
            Career: ['경력', '업무', '리더십', '협업', '면접', '이력서', '보고', '직장', '커리어'],
            Tech: ['코드', '프로그래밍', '개발', 'AI', '알고리즘', '데이터', '기술', '디지털'],
            Relationships: ['소통', '관계', '공감', '피드백', '갈등', '인간관계', '네트워킹'],
            Creativity: ['아이디어', '글쓰기', '디자인', '브레인스토밍', '창의', '예술', '상상력']
          },
          theme: 'light',
          defaultTopics: ['Productivity', 'Learning', 'Mindset', 'Health', 'Finance', 'Career', 'Tech', 'Relationships', 'Fitness', 'Creativity', 'Other']
        });
      }
    });
  }
}

export const db = new AppDB();