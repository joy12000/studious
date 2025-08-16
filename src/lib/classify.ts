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
      scores[topic] = (Array.isArray(keywords) ? keywords : []).reduce((s, kw) => s + (lc.includes(kw.toLowerCase()) ? 1 : 0), 0);
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


// A set of common English and Korean stop words to be excluded from title generation.
const STOP_WORDS = new Set([
  'the','is','are','a','an','to','of','and','or','for','in','on','at','it','this','that',
  '은','는','이','가','을','를','에','와','과','로','으로','하다','했다','합니다'
]);

/**
 * Generates a title from the note content.
 * It first tries to use the first line if it's short enough.
 * Otherwise, it extracts the most frequent keywords (excluding stop words)
 * to create a keyword-based title.
 * @param content The full content of the note.
 * @returns A generated title string.
 */
export function generateTitle(content: string): string {
  // Define configuration constants for clarity and easy maintenance.
  const FIRST_LINE_MAX_LENGTH = 50; // Use the first line if it's shorter than this.
  const TOP_KEYWORD_COUNT = 3;      // Number of top keywords to use for the title.
  const TITLE_MAX_LENGTH = 80;      // The maximum allowed length for the final title.

  const text = content.trim();
  const firstLine = text.split('\n').find(s => s.trim().length > 0) || '';

  // If the first line is short and descriptive, use it directly as the title.
  if (firstLine.length > 0 && firstLine.length <= FIRST_LINE_MAX_LENGTH) {
    return firstLine;
  }

  // If the first line is too long, generate a title from keywords.
  // 1. Clean the text: convert to lowercase and remove special characters.
  const cleanedText = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ');
  const tokens = cleanedText.split(/\s+/).filter(Boolean);

  // 2. Calculate the frequency of each word, excluding stop words.
  const wordFrequencies: Record<string, number> = {};
  for (const token of tokens) {
    if (!STOP_WORDS.has(token)) {
      wordFrequencies[token] = (wordFrequencies[token] || 0) + 1;
    }
  }

  // 3. Get the top N most frequent keywords.
  const topKeywords = Object.entries(wordFrequencies)
    .sort(([, freqA], [, freqB]) => freqB - freqA)
    .slice(0, TOP_KEYWORD_COUNT)
    .map(([word]) => word);

  // 4. Capitalize and join the keywords to form a draft title.
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  // Fallback to the first line if no keywords were found
  const draftTitle = topKeywords.map(capitalize).join(' · ') || firstLine;

  // 5. Truncate the title if it exceeds the maximum length.
  if (draftTitle.length <= TITLE_MAX_LENGTH) {
    return draftTitle;
  }
  return draftTitle.slice(0, TITLE_MAX_LENGTH - 1) + '…';
}


/**
 * Extracts highlighted sections from the content.
 * Highlights are identified by lines wrapped in double asterisks (e.g., **highlighted text**).
 * @param content The text content to parse.
 * @returns An array of objects, each containing the highlighted text and its line index.
 */
export function extractHighlights(content: string): { text: string; index: number }[] {
  // This regex captures text between double asterisks on a single line.
  const highlightRegex = /^\t*\t*(.+?)\t*\t*$/;
  
  return content
    .split('\n')
    .map((line, index) => {
      const match = line.match(highlightRegex);
      // If a match is found, return the captured text and its original line index.
      return match ? { text: match[1].trim(), index } : null;
    })
    // Filter out any lines that didn't match the highlight format.
    .filter((item): item is { text: string; index: number } => item !== null)
    // Limit the results to the first 10 highlights found.
    .slice(0, 10);
}

export function extractTodos(content: string): { text: string; done: boolean }[] {
  const todos: { text: string; done: boolean }[] = [];
  const text = content.replace(/\r/g, "");
  const lines = text.split('\n');

  // Regex to capture various todo list formats, pre-compiled for efficiency.
  const todoLineRegex = /^\s*(?:-\s*\[( |x)\]|[-*•·–—]|[\\\\][\d]+[.)]|(?:🔹|✅|▶️|→|➤|•))\s*(.+)$/i;

  for (const line of lines) {
    const match = line.match(todoLineRegex);
    if (match && match[2]) {
      const taskText = match[2].trim();
      if (taskText) {
        const isChecked = (match[1] || '').toLowerCase() === 'x';
        const hasDoneMarker = /(?:✅|done[:\s])/i.test(line);
        todos.push({ text: taskText, done: isChecked || hasDoneMarker });
      }
    }
  }

  // Inline todo detection (e.g., "To-do: buy milk, call mom")
  const inlineMatch = text.match(/(?:해야 할 일|To-?do|Action Items|Next Steps)[:\s]+([\s\S]{0,600})/i);
  if (inlineMatch && inlineMatch[1]) {
    inlineMatch[1].split(/[,;\n]+/).forEach(segment => {
      const trimmedSegment = segment.trim();
      // Avoid matching section summaries
      if (trimmedSegment.length > 4 && !/^(?:요약|핵심|참고)/.test(trimmedSegment)) {
        todos.push({ text: trimmedSegment, done: false });
      }
    });
  }

  // Deduplicate results and limit the count
  const seen = new Set<string>();
  const uniqueTodos: { text: string; done: boolean }[] = [];
  for (const todo of todos) {
    const key = todo.text.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueTodos.push(todo);
    }
  }
  
  return uniqueTodos.slice(0, 20);
}
