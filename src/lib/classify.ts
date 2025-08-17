import { db } from './db';
import type { TopicRule } from './types';

// 1. 강화된 내장 규칙: 다양한 토픽과 가중치(1점 또는 2점)를 가진 키워드들
export const DEFAULT_TOPIC_RULES: Record<string, Record<string, number>> = {
  '프로그래밍': { 'javascript': 2, 'typescript': 2, 'python': 2, 'react': 2, 'node.js': 2, '알고리즘': 2, '데이터베이스': 2, 'API': 1, '라이브러리': 1, '프레임워크': 1, '코딩': 1, '개발': 1, '디버깅': 1, '서버': 1, '클라이언트': 1 },
  '경제/금융': { '주식': 2, '부동산': 2, '투자': 2, '금리': 2, '인플레이션': 2, '환율': 2, '채권': 2, '세금': 1, '은행': 1, '대출': 1, '펀드': 1, '시장': 1, '경제': 1, '금융': 1, '자산': 1 },
  '건강/운동': { '헬스': 2, '다이어트': 2, '영양': 2, '스트레칭': 1, '칼로리': 1, '단백질': 1, '수면': 1, '명상': 1, '요가': 1, '필라테스': 1, '러닝': 1, '근력': 1, '유산소': 1 },
  '생산성': { '습관': 2, '루틴': 2, '집중': 2, '시간관리': 2, 'GTD': 2, '뽀모도로': 2, '우선순위': 1, '계획': 1, '목표': 1, '할일목록': 1, '노션': 1, '에버노트': 1 },
  '학습/자기계발': { '공부': 2, '학습': 2, '독서': 2, '메타인지': 2, '강의': 1, '세미나': 1, '스터디': 1, '지식': 1, '성장': 1, '커리어': 1, '면접': 1 },
  '마인드셋': { '심리학': 2, '뇌과학': 2, '동기부여': 2, '자존감': 2, '회복탄력성': 1, '감정': 1, '스트레스': 1, '멘탈': 1, '긍정': 1 },
  '마케팅/비즈니스': { '마케팅': 2, '브랜딩': 2, 'SEO': 2, '콘텐츠': 2, '퍼포먼스': 2, '영업': 1, '고객': 1, '시장조사': 1, '전략': 1, '기획': 1 },
  '창작/디자인': { '글쓰기': 2, '디자인': 2, 'UI/UX': 2, '브레인스토밍': 1, '아이디어': 1, '창의력': 1, '스토리텔링': 1, '카피라이팅': 1 },
  '여행': { '여행': 2, '항공권': 2, '호텔': 1, '숙소': 1, '관광': 1, '배낭여행': 1, '자유여행': 1 },
  '개인/일상': { '일기': 2, '회고': 2, '리뷰': 1, '후기': 1, '요리': 1, '레시피': 1, '취미': 1, '가족': 1, '친구': 1 },
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

    // esbuild의 정규식 해석 오류를 피하기 위해 new RegExp()를 사용하는 방식으로 변경
    const escapeRegExp = (str: string) => {
      // 정규식에서 특별한 의미를 갖는 문자들의 리스트
      const charsToEscape = ['\\', '[', ']', '{', '}', '(', ')', '*', '+', '?', '.', '^', '$', '|'];
      // 이스케이프된 문자들로 정규식 패턴 생성 (e.g., \\|\\[|\\]|...)
      const pattern = charsToEscape.map(char => `\\${char}`).join('|');
      const regex = new RegExp(pattern, 'g');
      return str.replace(regex, '\\$&');
    };

    // 헬퍼 함수: 텍스트에서 키워드를 찾아 점수 추가
    const addScore = (topic: string, keyword: string, weight: number) => {
      const pattern = `\\b${escapeRegExp(keyword.toLowerCase())}\b`;
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
