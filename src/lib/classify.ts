export async function generateTitle(text: string): Promise<string> {
  const t = (text || '').trim();
  if (!t) return '제목 없음';
  // 첫 줄 또는 40자 요약
  const firstLine = t.split('\n').find(line => line.trim().length > 0) || t;
  const out = firstLine.trim().slice(0, 80);
  return out || '제목 없음';
}

const TOPIC_RULES: Record<string, string[]> = {
  Productivity: ['습관','루틴','집중','시간','우선순위','체크리스트','할 일','계획','관리','todo','task'],
  Learning: ['학습','공부','독서','노트','요약','메모','강의','코스','튜토리얼','지식'],
  Mindset: ['동기','마인드셋','태도','회복탄력성','자존감','스트레스','감정','명상','철학'],
  Health: ['운동','헬스','달리기','영양','수면','요가','피트니스','건강'],
  Finance: ['투자','저축','지출','예산','수입','재무','돈','경제'],
  Career: ['경력','업무','리더십','협업','면접','이력서','보고','직장','커리어'],
  Tech: ['코드','프로그래밍','개발','AI','알고리즘','데이터','기술','디지털','서버','배포','버그','테스트','API','프론트','백엔드'],
  Relationships: ['소통','관계','공감','피드백','갈등','인간관계','네트워킹'],
  Creativity: ['아이디어','글쓰기','디자인','브레인스토밍','창의','예술','상상력'],
};

export async function guessTopics(text: string): Promise<string[]> {
  const t = (text || '').toLowerCase();
  const found: string[] = [];
  for (const [topic, words] of Object.entries(TOPIC_RULES)) {
    if (words.some(w => t.includes(w.toLowerCase()))) found.push(topic);
  }
  if (found.length === 0) found.push('Other');
  return found.slice(0, 5);
}

// Placeholders for compatibility
export async function extractHighlights(_text: string): Promise<string[]> { return []; }
export async function extractTodos(_text: string): Promise<{text:string; done:boolean}[]> { return []; }
