import { db } from './db';
import type { TopicRule } from './types';

export const DEFAULT_TOPIC_RULES: Record<string, Record<string, number>> = {
  '생산성': {
    '프로젝트': 2, '업무': 2, '회의': 2, '목표': 2, 'GTD': 2, '데드라인': 2,
    '할 일': 1, '계획': 1, '보고서': 1, '이메일': 1, '정리': 1, '효율': 1
  },
  '학습': {
    '강의': 2, '스터디': 2, '수업': 2, '배운 점': 2, '인사이트': 2, '논문': 2,
    '공부': 1, '책': 1, '요약': 1, '정리': 1, '질문': 1, '개념': 1
  },
  '자기계발': {
    '습관': 2, '성장': 2, '동기부여': 2, '회고': 2, '마인드셋': 2,
    '목표': 1, '다짐': 1, '루틴': 1, '생각': 1, '느낀 점': 1
  },
  '건강/운동': {
    '운동': 2, '헬스': 2, '식단': 2, '병원': 2, '영양제': 2, '스트레칭': 2,
    '건강': 1, '수면': 1, '칼로리': 1, '걷기': 1, '요가': 1
  },
  '경제/금융': {
    '주식': 2, '투자': 2, '부동산': 2, '가계부': 2, '예산': 2, '세금': 2,
    '돈': 1, '경제': 1, '은행': 1, '소비': 1, '절약': 1, '수입': 1
  },
  '기술/IT': {
    '코딩': 2, '개발': 2, '서버': 2, 'AI': 2, '알고리즘': 2, 'API': 2,
    '컴퓨터': 1, '프로그램': 1, '앱': 1, '오류': 1, '설치': 1, '데이터': 1
  },
  '창작/아이디어': {
    '아이디어': 2, '영감': 2, '브레인스토밍': 2, '기획': 2, '스토리': 2,
    '생각': 1, '메모': 1, '구상': 1, '디자인': 1, '글': 1
  },
  '관계/소통': {
    '대화': 2, '상담': 2, '미팅': 2, '피드백': 2, '연락처': 2,
    '친구': 1, '가족': 1, '동료': 1, '이름': 1, '조언': 1
  },
  '문화/취미': {
    '영화': 2, '책': 2, '음악': 2, '전시': 2, '게임': 2, '드라마': 2,
    '감상': 1, '후기': 1, '추천': 1, '리뷰': 1, '취미': 1
  },
  '여행': {
    '여행': 2, '항공권': 2, '숙소': 2, '일정': 2, '예약': 2, '환전': 2,
    '계획': 1, '준비물': 1, '짐싸기': 1, '공항': 1, '지도': 1
  },
  '음식/요리': {
    '레시피': 2, '맛집': 2, '요리': 2, '식당': 2, '카페': 2, '메뉴': 2,
    '음식': 1, '재료': 1, '주문': 1, '배달': 1, '맛': 1
  },
  '일상/쇼핑': {
    '쇼핑': 2, '구매': 2, '위시리스트': 2, '예약': 2, '주문': 2,
    '일상': 1, '메모': 1, '할 일': 1, '준비물': 1, '장보기': 1
  }
};

/**
 * 정규식 특수 문자를 이스케이프합니다.
 * @param str 이스케이프할 문자열
 * @returns 정규식 특수 문자가 이스케이프된 문자열
 */
export const escapeRegExp = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\\]/g, '\\$&');
};

// 2. 새로운 guessTopics 함수: 가중치 기반 점수 시스템
export async function guessTopics(text: string): Promise<string[]> {
  const MIN_SCORE_THRESHOLD = 3; // 토픽으로 인정받기 위한 최소 점수
  const MAX_TOPICS = 3; // 최종적으로 반환할 최대 토픽 개수

  try {
    // DB에서 사용자 정의 규칙 가져오기
    const userRules: TopicRule[] = await db.topicRules.toArray();
    const cleanedText = text.toLowerCase();
    const scores: Record<string, number> = {};

    // 헬퍼 함수: 텍스트에서 키워드를 찾아 점수 추가
    const addScore = (topic: string, keyword: string, weight: number) => {
      const pattern = `\b${escapeRegExp(keyword.toLowerCase())}\b`;
      const regex = new RegExp(pattern, 'g');
      const matches = cleanedText.match(regex);
      if (matches) {
        scores[topic] = (scores[topic] || 0) + (matches.length * weight);
      }
    };

    // 1순위: 사용자 정의 규칙 적용 (가중치 3점)
    for (const rule of userRules) {
      for (const keyword of rule.keywords) {
        addScore(rule.topic, keyword, 3);
      }
    }

    // 2순위: 내장 규칙 적용 (가중치 1~2점)
    for (const [topic, keywordsWithWeights] of Object.entries(DEFAULT_TOPIC_RULES)) {
      for (const [keyword, weight] of Object.entries(keywordsWithWeights)) {
        addScore(topic, keyword, weight);
      }
    }

    // 점수가 높은 순으로 토픽 정렬 및 필터링
    const rankedTopics = Object.entries(scores)
      .filter(([, score]) => score >= MIN_SCORE_THRESHOLD)
      .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
      .map(([topic]) => topic);

    // 해시태그 추출 (기존 로직 유지)
    const hashtagSet = new Set<string>();
    (text.match(/(^|\s)#([\p{L}\p{N}_-]{2,30})/gu) || []).forEach(m => {
      const tag = m.replace(/^\s*#/, '').trim();
      if (tag) hashtagSet.add(tag);
    });
    const hashtags = Array.from(hashtagSet);

    // 결과 통합: 해시태그와 점수 기반 토픽을 합치고 중복 제거
    const combined = [...new Set([...hashtags, ...rankedTopics])];
    
    if (combined.length > 0) {
      return combined.slice(0, MAX_TOPICS);
    }

    // 어떤 토픽도 찾지 못했을 경우 기본 토픽 반환
    const settings = await db.settings.get('default');
    return settings?.defaultTopics?.slice(0, 1) || ['일반'];

  } catch (e) {
    console.error('guessTopics error', e);
    return ['일반'];
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
  const todoLineRegex = /^\s*(?:-\s*\[( |x)\]|[-*•·–—]|\d+[.)]|(?:🔹|✅|▶️|→|➤|•))\s*(.+)$/i;

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
