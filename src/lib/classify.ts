import { db } from './db';

export const DEFAULT_TOPIC_RULES: Record<string, string[]> = {
  "Productivity": [
    "습관",
    "루틴",
    "집중",
    "시간",
    "우선순위",
    "체크리스트",
    "할 일",
    "타임블록",
    "계획",
    "관리",
    "todo",
    "task",
    "schedule",
    "deadline",
    "회의",
    "미팅"
  ],
  "Learning": [
    "학습",
    "공부",
    "기억",
    "복습",
    "필기",
    "메타인지",
    "요약",
    "독서",
    "지식",
    "스킬",
    "강의",
    "수업",
    "세미나",
    "스터디",
    "lecture",
    "course",
    "study"
  ],
  "Mindset": [
    "마인드",
    "동기",
    "자존감",
    "감정",
    "회복탄력성",
    "성장",
    "사고",
    "긍정",
    "마음가짐",
    "멘탈",
    "동기부여",
    "인내"
  ],
  "Health": [
    "수면",
    "식단",
    "건강",
    "스트레스",
    "휴식",
    "웰빙",
    "몸",
    "컨디션",
    "영양",
    "정신건강",
    "병원"
  ],
  "Fitness": [
    "운동",
    "웨이트",
    "러닝",
    "유산소",
    "근력",
    "체력",
    "트레이닝",
    "다이어트",
    "헬스",
    "요가",
    "필라테스",
    "run",
    "workout",
    "gym"
  ],
  "Finance": [
    "투자",
    "저축",
    "지출",
    "예산",
    "수입",
    "재무",
    "파이낸스",
    "돈",
    "경제",
    "청구",
    "결제",
    "부채",
    "세금",
    "금리",
    "ETF",
    "주식"
  ],
  "Career": [
    "경력",
    "업무",
    "리더십",
    "협업",
    "면접",
    "이력서",
    "보고",
    "직장",
    "커리어",
    "성과",
    "OKR",
    "승진",
    "목표",
    "feedback"
  ],
  "Tech": [
    "코드",
    "프로그래밍",
    "개발",
    "AI",
    "알고리즘",
    "데이터",
    "기술",
    "디지털",
    "서버",
    "배포",
    "리팩터링",
    "버그",
    "테스트",
    "API",
    "프론트",
    "백엔드"
  ],
  "Relationships": [
    "소통",
    "관계",
    "공감",
    "피드백",
    "갈등",
    "인간관계",
    "네트워킹",
    "팀워크",
    "회의문화",
    "커뮤니케이션"
  ],
  "Creativity": [
    "아이디어",
    "글쓰기",
    "디자인",
    "브레인스토밍",
    "창의",
    "예술",
    "상상력",
    "스케치",
    "콘셉트",
    "카피",
    "콘텐츠"
  ],
  "Travel": [
    "여행",
    "항공",
    "호텔",
    "예약",
    "여권",
    "비행기",
    "투어",
    "여정",
    "일정표",
    "관광",
    "바캉스",
    "휴양지"
  ],
  "Legal": [
    "법률",
    "계약",
    "약관",
    "분쟁",
    "저작권",
    "라이선스",
    "위험조항",
    "소송",
    "준법",
    "컴플라이언스"
  ],
  "Tax": [
    "세무",
    "세금",
    "부가세",
    "원천징수",
    "신고",
    "환급",
    "공제",
    "납부",
    "영수증",
    "세법"
  ],
  "Marketing": [
    "마케팅",
    "브랜딩",
    "캠페인",
    "광고",
    "콘텐츠",
    "SNS",
    "SEO",
    "퍼포먼스",
    "CRM",
    "리텐션",
    "전환",
    "랜딩"
  ],
  "Sales": [
    "영업",
    "견적",
    "구매",
    "고객",
    "리드",
    "계약서",
    "가격",
    "딜",
    "세일즈파이프라인",
    "MQL",
    "SQL",
    "콜"
  ],
  "Education": [
    "교육",
    "커리큘럼",
    "과제",
    "시험",
    "평가",
    "강의안",
    "학습계획",
    "MOOC"
  ],
  "Project": [
    "프로젝트",
    "기획",
    "요구사항",
    "타임라인",
    "마일스톤",
    "칸반",
    "이슈",
    "티켓",
    "스코프",
    "리소스"
  ],
  "Research": [
    "연구",
    "실험",
    "논문",
    "데이터셋",
    "가설",
    "분석",
    "리뷰",
    "재현성",
    "실험계획"
  ],
  "Personal": [
    "일기",
    "회고",
    "목표",
    "감사일기",
    "버킷리스트",
    "취미",
    "생활"
  ]
};

export async function guessTopics(text: string): Promise<string[]> {
  try {
    const settings = await db.settings.get('default');
    const rules = { ...DEFAULT_TOPIC_RULES, ...(settings?.topicRules || {}) };

    const lc = text.toLowerCase();
    const scores: Record<string, number> = {};

    for (const [topic, keywords] of Object.entries(rules)) {
      scores[topic] = keywords.reduce((s, kw) => s + (lc.includes(kw.toLowerCase()) ? 1 : 0), 0);
    }

    const hashtagSet = new Set<string>();
    (text.match(/(^|\s)#([\p{L}\p{N}_-]{2,30})/gu) || []).forEach(m => {
      const tag = m.replace(/^\s*#/, '').trim();
      if (tag) hashtagSet.add(tag);
    });

    const ranked = Object.entries(scores)
      .filter(([,s]) => s > 0)
      .sort((a,b)=>b[1]-a[1])
      .slice(0,5)
      .map(([k])=>k);

    const hashtags = Array.from(hashtagSet).slice(0,5);
    const combined = [...new Set([ ...hashtags, ...ranked ])];
    return combined.length ? combined : (settings?.defaultTopics?.slice(0,1) || ['Other']);
  } catch (e) {
    console.error('guessTopics error', e);
    return ['Other'];
  }
}

export function generateTitle(content: string): string {
  const text = content.trim();
  const firstLine = text.split('\n').find(s=>s.trim().length>0) || '';
  if (firstLine.length <= 50) return firstLine;
  const cleaned = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ');
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const stop = new Set(['the','is','are','a','an','to','of','and','or','for','in','on','at','it','this','that','은','는','이','가','을','를','에','와','과','로','으로','하다','했다','합니다']);
  const freq: Record<string, number> = {};
  for (const t of tokens) if (!stop.has(t)) freq[t] = (freq[t]||0)+1;
  const top = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([w])=>w as string);
  const cap = (s:string)=>s.charAt(0).toUpperCase()+s.slice(1);
  const draft = top.map(cap).join(' · ') || firstLine;
  return draft.length <= 80 ? draft : draft.slice(0,79)+'…';
}

export function extractHighlights(content: string): { text: string; index: number }[] {
  const lines = content.split('\n');
  const out: { text: string; index: number }[] = [];
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 4) {
      out.push({ text: trimmed.replace(/^\*\*|\*\*$/g,''), index: i });
    }
  });
  return out.slice(0, 10);
}

export function extractTodos(content: string): { text: string; done: boolean }[] {
  const todos: { text: string; done: boolean }[] = [];
  const text = content.replace(/\r/g,'');

  const sectionNames = [
    'Action Items','Next Steps','Tasks','To-Do','Todo','To Do','Recommendations','Key Takeaways','핵심 정리','다음 단계','할 일','권장 사항'
  ];
  const headingRe = new RegExp(`^(?:\s*)(?:${sectionNames.map(s=>s.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')).join('|')})\s*:?\s*$`, 'im');

  const lines = text.split('\n');
  for (let i=0; i<lines.length; i++) {
    if (headingRe.test(lines[i])) {
      let block: string[] = [];
      let blanks = 0;
      for (let j=i+1; j<lines.length; j++) {
        const L = lines[j];
        if (headingRe.test(L)) break;
        if (!L.trim()) { blanks++; if (blanks>=2) break; else continue; } else blanks=0;
        block.push(L);
      }
      block.forEach(L => {
        const m = L.match(/^\s*(?:-\s*\[( |x)\]|[-*•·–—]|[\d]+[.)]|(?:🔹|✅|▶️|→|➤|•))\s*(.+)$/i);
        if (m && m[2]) {
          const done = (m[1]||'').toLowerCase()==='x' || /(?:✅|done[:\s])/i.test(L);
          const t = m[2].trim();
          if (t) todos.push({ text: t, done });
        }
      });
    }
  }

  text.split('\n').forEach(L => {
    const m = L.match(/^\s*(?:-\s*\[( |x)\]|[-*•·–—]|[\d]+[.)])\s*(.+)$/i);
    if (m && m[2]) {
      const done = (m[1]||'').toLowerCase()==='x' || /(?:✅|done[:\s])/i.test(L);
      const t = m[2].trim();
      if (t) todos.push({ text: t, done });
    }
  });

  const inline = text.match(/(?:해야 할 일|To-?do|Action Items|Next Steps)[:\s]+([\s\S]{0,600})/i);
  if (inline) {
    inline[1].split(/[,;\n]+/).forEach(seg => {
      const t = seg.trim();
      if (t.length>4 && !/^(?:요약|핵심|참고)/.test(t)) todos.push({ text: t, done: false });
    });
  }

  const seen = new Set<string>();
  const out: { text: string; done: boolean }[] = [];
  for (const td of todos) {
    const key = td.text.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push(td); }
  }
  return out.slice(0, 20);
}
