import { db } from './db';

export const DEFAULT_TOPIC_RULES: Record<string, string[]> = {
  Productivity: ['습관','루틴','집중','시간','우선','체크','할 일','todo','task','계획','관리'],
  Learning: ['공부','학습','강의','강좌','시험','복습','요약','필기','노트'],
  Mindset: ['동기','동기부여','마인드','멘탈','감정','감사','회고','리플렉션','성찰'],
  Health: ['운동','헬스','런닝','식단','수면','명상','건강'],
  Finance: ['투자','저축','지출','예산','수입','돈','경제','파이낸스'],
  Career: ['경력','업무','리더십','협업','면접','이력서','보고','직장','커리어'],
  Tech: ['코드','프로그래밍','개발','AI','알고리즘','데이터','기술','디지털'],
  Relationships: ['소통','관계','공감','피드백','갈등','인간관계','네트워킹'],
  Creativity: ['아이디어','글쓰기','디자인','브레인스토밍','창의','예술','상상력'],
  Other: []
};

export async function guessTopics(text: string): Promise<string[]> {
  try {
    const settings = await db.settings.get('default');
    const rules = { ...DEFAULT_TOPIC_RULES, ...(settings?.topicRules || {}) };
    const lc = (text || '').toLowerCase();

    const scores: Record<string, number> = {};
    Object.keys(rules).forEach(topic => { scores[topic] = 0; });

    for (const [topic, keywords] of Object.entries(rules)) {
      for (const kw of keywords) {
        if (!kw) continue;
        if (lc.includes(kw.toLowerCase())) scores[topic] += 1;
      }
    }

    const ranked = Object.entries(scores)
      .filter(([, s]) => s > 0)
      .sort((a,b) => b[1]-a[1])
      .slice(0, 5)
      .map(([k]) => k);

    if (ranked.length) return ranked;
    return settings?.defaultTopics?.slice(0,1) || ['Other'];
  } catch (e) {
    console.error('guessTopics error', e);
    return ['Other'];
  }
}

export function generateTitle(text: string): string {
  const first = (text || '').trim().split(/\r?\n/).find(Boolean) || '메모';
  return first.length > 40 ? first.slice(0, 40) + '…' : first;
}

export function extractHighlights(text: string): string[] {
  const lines = (text || '').split(/\r?\n/).map(s => s.trim());
  return lines.filter(l => /^\*\*.+\*\*$/.test(l)).map(l => l.replace(/^\*\*|\*\*$/g, ''));
}

export function extractTodos(text: string): { text: string; done: boolean }[] {
  const lines = (text || '').split(/\r?\n/);
  return lines
    .filter(l => /^\s*- \[( |x|X)\]/.test(l))
    .map(l => ({ text: l.replace(/^\s*- \[( |x|X)\]\s*/, ''), done: /\[(x|X)\]/.test(l) }));
}
