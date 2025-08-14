import Dexie, { Table } from 'dexie';
import type { Note, AppSettings } from './types';

class AppDB extends Dexie {
  notes!: Table<Note, string>;
  settings!: Table<(AppSettings & { id: string }), string>;

  constructor() {
    super('selfdev-db');
    this.version(1).stores({
      notes: 'id, createdAt, *topics, favorite, sourceType',
      settings: 'id'
    });

    this.on('ready', async () => {
      const exists = await this.settings.get('default');
      if (!exists) {
        const defaults: AppSettings & { id: string } = {
          id: 'default',
          theme: 'light',
          topicRules: {
            Productivity: ['습관','루틴','집중','시간','우선','체크','할 일','todo','task','계획','관리'],
            Learning: ['공부','학습','강의','강좌','시험','복습','요약','필기','노트'],
            Mindset: ['동기','동기부여','마인드','멘탈','감정','감사','회고','리플렉션','성찰'],
            Health: ['운동','헬스','런닝','식단','수면','명상','건강'],
            Finance: ['투자','저축','지출','예산','수입','돈','경제','파이낸스'],
            Career: ['경력','업무','리더십','협업','면접','이력서','보고','직장','커리어'],
            Tech: ['코드','프로그래밍','개발','AI','알고리즘','데이터','기술','디지털'],
            Relationships: ['소통','관계','공감','피드백','갈등','인간관계','네트워킹'],
            Creativity: ['아이디어','글쓰기','디자인','브레인스토밍','창의','예술','상상력']
          },
          defaultTopics: ['Productivity','Learning','Mindset','Health','Finance','Career','Tech','Relationships','Creativity','Other']
        };
        await this.settings.put(defaults);
      }
    });
  }
}

export const db = new AppDB();
