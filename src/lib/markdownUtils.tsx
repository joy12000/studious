// src/lib/markdownUtils.ts
/* eslint-disable no-useless-escape */

/**
 * markdownUtils.ts
 *
 * - 마크다운 전체에서 ```mermaid 코드블록을 찾아 안정적으로 정규화합니다.
 * - 단일 Mermaid 코드 문자열을 정규화하는 함수도 제공합니다.
 * - Flowchart/Graph에만 적극 보정(노드/엣지/레이블/서브그래프 등), 그 외 타입은 보수적 처리.
 * - htmlLabels:false 환경을 기본 가정하여 <br> → \n(리터럴) 보정, 괄호노드 멀티라인 → 대괄호로 전환.
 * - 다이어그램 내부 init 지시어(%%{init:...}%%)는 제거하여 전역 초기화와 충돌 방지.
 * - 줄 경계가 붙어 생기는 파싱 에러를 줄이기 위한 “세이프티 개행 보강” 포함(타입별).
 */

export type Direction = 'TB' | 'TD' | 'BT' | 'LR' | 'RL';
export type DiagramHeader =
  | 'graph'
  | 'flowchart'
  | 'sequenceDiagram'
  | 'gantt'
  | 'pie'
  | 'erDiagram'
  | 'journey'
  | 'classDiagram'
  | 'stateDiagram'
  | 'stateDiagram-v2'
  | 'gitGraph'
  | 'mindmap'
  | 'timeline'
  | 'quadrantChart'
  | 'sankey'
  | 'requirementDiagram'
  | 'xychart-beta'
  | 'unknown';

export interface NormalizeOptions {
  /** flowchart/graph 기본 방향 (헤더 자동 보충이 필요한 경우에만 사용) */
  defaultFlowDirection?: Direction;
  /** 결과를 ```mermaid 펜스로 감쌀지 (단일 코드 정규화에만 해당) */
  wrapInCodeFence?: boolean;
  /** 경고를 %% 주석으로 결과에 첨부 */
  attachWarningsAsComments?: boolean;
  /** (비권장) 비-flow 타입에도 헤더 자동 보충 허용 */
  enableHeaderAutofillForNonFlow?: boolean;
  /** (보수) subgraph "타이틀" → subgraph 타이틀 (따옴표 제거) */
  stripQuotedSubgraphTitle?: boolean;
  /** (권장) 다이어그램 내부의 %%{init:...}%% 지시어 제거 */
  stripInlineInitDirective?: boolean;
  /** (권장) 멀티라인 라벨을 괄호노드로 쓴 경우 []로 강제 전환 */
  transformParenMultilineToBracket?: boolean;
}

const DEFAULT_OPTS: NormalizeOptions = {
  defaultFlowDirection: 'TB',
  wrapInCodeFence: false,
  attachWarningsAsComments: false,
  enableHeaderAutofillForNonFlow: false,
  stripQuotedSubgraphTitle: false,
  stripInlineInitDirective: true,
  transformParenMultilineToBracket: true,
};

const FLOW_HEADERS = new Set<DiagramHeader>(['graph', 'flowchart']);
const NON_FLOW_HEADERS = new Set<DiagramHeader>([
  'sequenceDiagram','gantt','pie','erDiagram','journey','classDiagram',
  'stateDiagram','stateDiagram-v2','gitGraph','mindmap','timeline',
  'quadrantChart','sankey','requirementDiagram','xychart-beta'
]);

// 예약어(소문자) — 노드 내부 텍스트가 순수 예약어면 인용 필요
const MERMAID_KEYWORDS = new Set([
  'graph','subgraph','end','style','classdef','linkstyle','click',
  'flowchart','sequencediagram','gantt','pie','statediagram','statediagram-v2',
  'erdiagram','journey','requirementdiagram','gitgraph','mindmap','timeline',
  'quadrantchart','sankey','xychart-beta','classdiagram'
]);

const SPECIAL_CHARS_REGEX = /[(),;:]/;
const INVISIBLE_CHARS = /[\u200B-\u200D\uFEFF]/g; // zero-width chars
const NBSP = /\u00A0/g;

/* --------------------------------------------------------------------------------
 * Public API
 * -------------------------------------------------------------------------------- */

/** 전체 마크다운에서 ```mermaid 코드블록을 찾아서 개별적으로 정규화 */
export function normalizeMermaidInMarkdown(markdown: string, opts: NormalizeOptions = {}): string {
  if (!markdown) return markdown;

  return markdown.replace(/```mermaid\s*([\s\S]*?)```/gi, (_m, inner) => {
    const fixed = normalizeMermaidCode(String(inner || ''), opts);
    return '```mermaid\n' + fixed + '\n```';
  });
}

/** 단일 Mermaid 코드 문자열 정규화 (삼중펜스 없이 본문만 입력) */
export function normalizeMermaidCode(input: string, opts: NormalizeOptions = {}): string {
  const O = { ...DEFAULT_OPTS, ...opts };

  // 0) 전처리: BOM/인비저블/nbsp 제거
  let code = (input || '')
    .replace(/^\uFEFF/, '')
    .replace(INVISIBLE_CHARS, '')
    .replace(NBSP, ' ')
    .trim();

  if (!code) return `graph ${O.defaultFlowDirection}`;

  // 1) 멀티라인 주석 → %% 라인 주석화
  code = code.replace(/\/\*([\s\S]*?)\*\//g, (_m, body) =>
    body.split('\n').map(s => '%% ' + s.trim()).join('\n')
  );

  // 2) 라인 분해 + 기본 클린업
  const rawLines = code.split(/\r?\n/);
  let lines = rawLines.map(s => s.trim()).filter(Boolean);

  // 2-1) 다이어그램 내부 init 지시어 제거 (전역 initialize와 충돌 방지)
  if (O.stripInlineInitDirective) {
    lines = lines.filter(l => !/^%%\s*\{init:/i.test(l));
  }

  // 3) 헤더 감지(명시)
  const explicit = detectExplicitHeader(lines);
  let header: DiagramHeader = explicit?.header ?? 'unknown';
  let headerSeen = !!explicit;

  // 4) 명시 헤더 없으면 보수적 추론
  if (!headerSeen) header = inferDiagramHeader(lines);

  const warnings: string[] = [];
  let resultLines: string[] = [];

  if (FLOW_HEADERS.has(header)) {
    // ===== flowchart/graph 계열: 적극 보정 =====
    const r = normalizeFlowchartLike(lines, {
      headerSeen,
      defaultDir: O.defaultFlowDirection!,
      stripQuotedSubgraphTitle: O.stripQuotedSubgraphTitle!,
      transformParenMultilineToBracket: O.transformParenMultilineToBracket!,
    });
    resultLines = r.lines;
    headerSeen = r.headerSeen;
    warnings.push(...r.warnings);

    if (!headerSeen && r.shouldAutofillHeader) {
      resultLines.unshift(`graph ${O.defaultFlowDirection}`);
      headerSeen = true;
      warnings.push('Inserted default "graph" header for flowchart-like content.');
    }

  } else if (NON_FLOW_HEADERS.has(header)) {
    // ===== 비-flowchart: 보수적 정리만 =====
    const r = normalizeNonFlowMinimal(lines, header, {
      enableHeaderAutofill: O.enableHeaderAutofillForNonFlow!,
    });
    resultLines = r.lines;
    if (r.warning) warnings.push(r.warning);

  } else {
    // ===== unknown: 최대 보수 =====
    const r = normalizeUnknownVeryConservative(lines);
    resultLines = r.lines;
    if (r.seemsFlowLike && !r.hasClassOrStateHints) {
      resultLines.unshift(`graph ${O.defaultFlowDirection}`);
      warnings.push('No header found; inferred flowchart. Inserted "graph" header.');
    } else {
      warnings.push('No explicit header and type unknown; skipped header insertion.');
    }
  }

  // 5) 최종 조립
  let final = resultLines.join('\n');

  // 타입별 세이프티 개행 보강 (줄경계 붙음 방지)
  if (header === 'sequenceDiagram') {
    final = enforceSafetyNewlinesSequence(final);
  } else {
    // graph/flowchart/unknown 포함: flow 보강을 적용해도 안전
    final = enforceSafetyNewlinesFlow(final);
  }

  // ✳️ 라벨 내부 줄바꿈은 \n(리터럴)로 유지해야 Mermaid가 줄바꿈 처리하므로 replace(/\\n/,'\n') 금지
  if (opts.attachWarningsAsComments && warnings.length) {
    final = ['%% WARN: ' + warnings.join(' | '), final].join('\n');
  }

  return opts.wrapInCodeFence ? fence(final) : final;
}

/* --------------------------------------------------------------------------------
 * 내부 유틸/핵심 로직
 * -------------------------------------------------------------------------------- */

function fence(s: string) {
  return '```mermaid\n' + s + '\n```';
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripComment(line: string): string {
  if (/^%%/.test(line)) return '';
  return line.replace(/\s*;+\s*$/, ''); // 말미 세미콜론 제거
}

function detectExplicitHeader(lines: string):
  | { header: DiagramHeader; index: number }
  | null
{
  for (let i = 0; i < lines.length; i++) {
    const L = stripComment(lines[i]);
    if (!L) continue;
    if (/^(graph|flowchart)\b/i.test(L)) {
      return { header: L.split(/\s+/)[0] as DiagramHeader, index: i };
    }
    const heads: DiagramHeader[] = [
      'sequenceDiagram','gantt','pie','erDiagram','journey','classDiagram',
      'stateDiagram-v2','stateDiagram','gitGraph','mindmap','timeline',
      'quadrantChart','sankey','requirementDiagram','xychart-beta'
    ];
    for (const h of heads) {
      const re = new RegExp('^' + escapeReg(h) + '\\b', 'i');
      if (re.test(L)) return { header: h, index: i };
    }
  }
  return null;
}

function inferDiagramHeader(lines: string): DiagramHeader {
  // 오인식 최소화: flow 화살표는 -->, -.->, <--> 만 카운트 (class의 <|-- 등 제외)
  let flowHits = 0, seqHits = 0, classHits = 0, stateHits = 0;

  for (const raw of lines) {
    const L = stripComment(raw);
    if (!L) continue;

    // flow: 전형적 노드/서브그래프/명확한 화살표
    if (/^[A-Za-z_][\w-]*\s*(\[\[?|\(\(?|\{\{?|\{>)/.test(L)) flowHits++;
    if (/(^|[^<])(-->|-\.->|<-->)/.test(L)) flowHits++;
    if (/\bsubgraph\b/i.test(L)) flowHits++;

    // sequence
    if (/^\s*(actor|participant)\b/i.test(L)) seqHits++;
    if (/-{1,2}>{1,2}[^:]*:/.test(L)) seqHits++; // Alice->>John: Hello!

    // class
    if (/\<\|--|--\|>|\*--|o--|--\*|--o/.test(L)) classHits++;

    // state
    if (/^\s*\[\*\]\s*-->|-->\s*\[\*\]/.test(L) || /^\s*state\s+/i.test(L)) stateHits++;
  }

  if (classHits >= 2 && classHits >= flowHits + seqHits) return 'classDiagram';
  if (stateHits >= 2 && stateHits >= flowHits + seqHits) return 'stateDiagram';
  if (flowHits  >= 2 && flowHits  >= seqHits + 1)      return 'flowchart';
  if (seqHits   >= 2 && seqHits   >= flowHits + 1)     return 'sequenceDiagram';
  return 'unknown';
}

/* ---------- flowchart 파이프라인 ---------- */

function normalizeFlowchartLike(
  lines: string[],
  opts: {
    headerSeen: boolean;
    defaultDir: Direction;
    stripQuotedSubgraphTitle: boolean;
    transformParenMultilineToBracket: boolean;
  }
): { lines: string[]; headerSeen: boolean; shouldAutofillHeader: boolean; warnings: string[] } {

  const warnings: string[] = [];
  const out: string[] = [];
  let headerSeen = opts.headerSeen;
  let subgraphDepth = 0;
  let sawFlowSignature = false;

  for (let raw of lines) {
    let line = raw.trim();
    if (!line) continue;

    // 주석 통일
    if (line.startsWith('//') || line.startsWith('#')) {
      out.push('%% ' + line.replace(/^\/\/|^#/, '').trim());
      continue;
    }

    // 헤더 정규화(중복 방지)
    const hdr = parseAndNormalizeFlowHeader(line);
    if (hdr) {
      if (!headerSeen) {
        out.push(`${hdr.header} ${hdr.direction}`);
        headerSeen = true;
      }
      continue; // 중복 헤더는 버림
    }

    // <br> → \n(리터럴) (후단에서 실제 개행으로 치환하지 않음)
    line = line.replace(/<br\s*\/?>/gi, '\\n');

    // subgraph 제목 처리
    if (/^subgraph\b/i.test(line)) {
      const m = line.match(/^subgraph\s+(.+)$/i);
      const titleRaw = m ? m[1].trim() : '';
      if (titleRaw) {
        let title = titleRaw;
        if (opts.stripQuotedSubgraphTitle && /^".+"$/.test(titleRaw)) {
          // 옵션이 켜진 경우: 따옴표 제거
          title = titleRaw.replace(/^"(.+)"$/, '$1');
        } else if (!opts.stripQuotedSubgraphTitle && /\s/.test(titleRaw) && !/^".+"$/.test(titleRaw)) {
          // 공백 포함인데 인용 안했으면 인용
          title = `"${escapeQuotes(titleRaw)}"`;
        }
        out.push(`subgraph ${title}`);
        subgraphDepth++;
        sawFlowSignature = true;
        continue;
      }
    }

    if (/^end$/i.test(line)) {
      if (subgraphDepth === 0) { warnings.push('Orphan "end" found.'); continue; }
      subgraphDepth--; out.push('end'); continue;
    }

    // 엣지/화살표/레이블 표준화 (flow 전용)
    const beforeArrows = line;
    line = normalizeFlowArrows(line);
    if (line !== beforeArrows) sawFlowSignature = true;

    const beforeLabels = line;
    line = normalizeFlowEdgeLabels(line);
    if (line !== beforeLabels) sawFlowSignature = true;

    // 노드 정의(괄호/대괄호/중괄호)
    const beforeNode = line;
    line = normalizeFlowNodeDefinition(line, { transformParenMultilineToBracket: opts.transformParenMultilineToBracket });
    if (line !== beforeNode) sawFlowSignature = true;

    // style/linkStyle/classDef
    if (/^(style|linkStyle)\b/i.test(line)) {
      line = line.replace(/;+\s*$/,'');
      line = line.replace(/stroke-dasharray:\s*([\d\s]+)/gi, (_m, values) =>
        `stroke-dasharray:${values.trim().replace(/\s+/g, ',')}`
      );
      sawFlowSignature = true;
    } else if (/^classDef\b/i.test(line)) {
      line = line.replace(/\s*;\s*$/,'');
      sawFlowSignature = true;
    }

    out.push(line);
  }

  // subgraph 보정
  while (subgraphDepth > 0) {
    out.push('end'); subgraphDepth--;
    warnings.push('Inserted missing "end" for subgraph.');
  }

  // 헤더가 없고 flowchart signature가 충분하면 헤더 보충
  const shouldAutofillHeader = !headerSeen && sawFlowSignature;

  return { lines: out, headerSeen, shouldAutofillHeader, warnings };
}

function parseAndNormalizeFlowHeader(line: string):
  | { header: 'graph' | 'flowchart'; direction: Direction }
  | null
{
  const m = line.match(/^(graph|flowchart)\s*[:\-]?\s*([A-Za-z]{2})\b/i);
  if (!m) return null;
  const header = m[1].toLowerCase() as 'graph' | 'flowchart';
  let dir = m[2].toUpperCase() as Direction;
  if (dir === 'TD') dir = 'TB';
  if (!['TB','BT','LR','RL'].includes(dir)) dir = 'TB';
  return { header, direction: dir };
}

function normalizeFlowArrows(line: string): string {
  // --- > → --->
  line = line.replace(/-{3}\s+>/g, '--->');
  // - .-> → -.-> (점선)
  line = line.replace(/-\s*\.->/g, '-.->');
  // -- > → -->,  - > → ->  (flow 전용)
  line = line.replace(/-\s*-\s*>/g, '-->');
  line = line.replace(/-\s*>/g, '->');
  return line;
}

function needsQuotes(text: string): boolean {
  return /\s/.test(text) || SPECIAL_CHARS_REGEX.test(text) || MERMAID_KEYWORDS.has(text.toLowerCase());
}
function escapeQuotes(s: string): string { return s.replace(/"/g, '&quot;'); }

/** 엣지 레이블 보정 (flow 전용) */
function normalizeFlowEdgeLabels(line: string): string {
  // |label| → "label"
  line = line.replace(/--\s*\|([^|]+)\|\s*--/g, (_m, label) => `-- "${escapeQuotes(label.trim())}" --`);
  line = line.replace(/--\s*\|([^|]+)\|\s*-->/g, (_m, label) => `-- "${escapeQuotes(label.trim())}" -->`);
  line = line.replace(/-\.->\s*\|([^|]+)\|\s*([-\w>]+)/g, (_m, label, tail) => `-. "${escapeQuotes(label.trim())}" .-> ${tail}`);

  // 공백/특수문자/예약어 포함 텍스트 자동 인용
  line = line.replace(
    /(--|-{3}|-\.->)\s*([^\s"->][^->]*?)\s*(-->|--|-\.\->)/g,
    (_m, left, text, right) => {
      const t = String(text).trim();
      if (!t) return `${left} ${right}`;
      if (needsQuotes(t)) return `${left} "${escapeQuotes(t)}" ${right}`;
      return `${left} ${t} ${right}`;
    }
  );
  return line;
}

/**
 * 노드 정의 보정 (flow 전용)
 * - ID + 여는 토큰( [ [[ ( (( { {{ {> )을 인식
 * - 내용이 멀티라인(\n 리터럴 포함)이고 형태가 ()이면 []로 강제 전환 (htmlLabels:false 안정화)
 * - 이미 따옴표로 감싼 경우 내부의 추가 따옴표는 &quot;로 이스케이프
 * - 인용이 필요하면 내용만 "..."로 감싸되, 원래 괄호 모양은 유지
 */
function normalizeFlowNodeDefinition(
  line: string,
  opt: { transformParenMultilineToBracket: boolean }
): string {
  const idMatch = line.match(/^([A-Za-z_][\w-]*)(\s*)(\[\[?|\(\(?|\{\{?|\{>)/);
  if (!idMatch) return line;

  const id = idMatch[1];
  const ws = idMatch[2];
  const open = idMatch[3];

  const OPEN_TO_CLOSE: Record<string,string> = {
    '[':']','[[':']]',
    '(' :')','((':'))',
    '{' :'}','{{':'}}',
    '{>': '}>',
  };
  const close = OPEN_TO_CLOSE[open] || ']';

  const startIdx = idMatch[0].length;
  const rest = line.slice(startIdx);

  const endIdx = rest.indexOf(close);
  let content = endIdx === -1 ? rest.trim() : rest.slice(0, endIdx);
  const tail = endIdx === -1 ? '' : rest.slice(endIdx + close.length);

  // \n 리터럴 유지
  const rawContent = content;

  const isQuoted = rawContent.startsWith('"') && rawContent.endsWith('"');
  const inner = isQuoted ? rawContent.slice(1, -1) : rawContent;

  const isMultiline = /\\n/.test(inner) || /\n/.test(inner);

  // () 노드에서 멀티라인 라벨이면 [] 노드로 강제 전환 (안정성)
  let effOpen = open;
  let effClose = close;
  if (opt.transformParenMultilineToBracket && (open === '(' || open === '((') && isMultiline) {
    effOpen = open.replace(/\(/g, '['); // '(' 또는 '((' → '[' 또는 '[['
    effClose = effOpen === '[[' ? ']]' : ']';
  }

  // 인용 필요성 판단
  const shouldQuote =
    isMultiline ||
    SPECIAL_CHARS_REGEX.test(inner) ||
    MERMAID_KEYWORDS.has(inner.trim().toLowerCase()) ||
    /^\s|\s$/.test(inner);

  // 이미 인용된 경우: 내부의 추가 따옴표를 &quot;로 이스케이프
  let normalizedInner = inner;
  if (isQuoted) {
    normalizedInner = inner.replace(/"/g, '&quot;');
  } else if (shouldQuote) {
    normalizedInner = `"${escapeQuotes(inner)}"`;
  }

  return `${id}${ws}${effOpen}${normalizedInner}${effClose}${tail}`;
}

/* ---------- 비-flowchart 파이프라인(보수적) ---------- */

function normalizeNonFlowMinimal(
  lines: string[],
  header: DiagramHeader,
  opts: { enableHeaderAutofill: boolean }
): { lines: string[]; warning?: string } {

  const out: string[] = [];
  let sawHeader = false;

  for (let raw of lines) {
    let line = raw.trim();
    if (!line) continue;

    // 주석 통일
    if (line.startsWith('//') || line.startsWith('#')) {
      out.push('%% ' + line.replace(/^\/\/|^#/, '').trim());
      continue;
    }

    // 헤더 표준화
    if (new RegExp('^' + escapeReg(header) + '\\b', 'i').test(line)) {
      if (!sawHeader) {
        out.push(header);
        sawHeader = true;
      }
      continue; // 중복 헤더는 무시
    }

    // 공통 정리: 말미 세미콜론 제거, <br> → \n(리터럴)
    line = line.replace(/;+\s*$/,'').replace(/<br\s*\/?>/gi, '\\n');

    // 비-flow: 엣지/노드/스타일 보정 금지 (문법 파괴 방지)
    out.push(line);
  }

  if (!sawHeader && opts.enableHeaderAutofill) {
    out.unshift(header);
    return { lines: out, warning: `Inserted missing "${header}" header (opt-in).` };
  }

  return { lines: out };
}

/* ---------- 불명(최대 보수) ---------- */

function normalizeUnknownVeryConservative(lines: string[]) {
  const out: string[] = [];
  let flowHits = 0;
  let classOrState = 0;

  for (let raw of lines) {
    let line = raw.trim();
    if (!line) continue;

    if (line.startsWith('//') || line.startsWith('#')) {
      out.push('%% ' + line.replace(/^\/\/|^#/, '').trim());
      continue;
    }

    line = line.replace(/;+\s*$/,'').replace(/<br\s*\/?>/gi, '\\n');

    // 흐름도 시그니처
    if (/^[A-Za-z_][\w-]*\s*(\[\[?|\(\(?|\{\{?|\{>)/.test(line)) flowHits++;
    if (/(^|[^<])(-->|-\.->|<-->)/.test(line)) flowHits++;
    if (/\bsubgraph\b/i.test(line)) flowHits++;

    // class/state 힌트
    if (/\<\|--|--\|>|\*--|o--|--\*|--o/.test(line)) classOrState++;
    if (/^\s*\[\*\]\s*-->|-->\s*\[\*\]/.test(line) || /^\s*state\s+/i.test(line)) classOrState++;

    out.push(line);
  }

  return { lines: out, seemsFlowLike: flowHits >= 2, hasClassOrStateHints: classOrState > 0 };
}

/* ---------- 세이프티 개행 보강 (강화판) ---------- */

/** flowchart/graph용: 줄 경계가 붙어버린 경우 복구 (강화판) */
function enforceSafetyNewlinesFlow(s: string): string {
  return s
    // 0) direction 라인: "direction LR" 뒤에 뭐가 붙으면 개행
    .replace(/(^|\n)\s*(direction\s+(?:TB|TD|BT|LR|RL))\s*(?=\S)/gi, '$1$2\n')

    // 1) 'end' 뒤에 다음 토큰이 바로 오면 개행 (노드/서브그래프/스타일/클래스/클릭/방향/식별자)
    .replace(/(^|\n)\s*(end)\s*(?=(?:subgraph|style|linkStyle|classDef|click|direction|[A-Za-z_[(\{]))/gi, '$1$2\n')

    // 2) 닫힘 토큰 ] } ) 뒤에 다음 토큰(식별자/명령)이 바로 오면 개행
    //   단, -->, -.-, <--> 등 엣지/공백으로 이어지는 경우는 제외
    .replace(/(\]|\}|\))(?=(?:(?!\s*(?:-|\.|<|\)|\]|\}|$))\S))/g, '$1\n')

    // 3) subgraph/style/linkStyle/classDef/click/direction 앞에 줄바꿈이 없으면 개행
    .replace(/([^\n])\s*(?=(subgraph|style|linkStyle|classDef|click|direction)\b)/gi,
      (m, prev) => (/\n$/.test(prev) ? m : prev + '\n'));
}

/** sequenceDiagram용: 메시지 경계 복구 */
function enforceSafetyNewlinesSequence(s: string): string {
  return s
    // 1) "A->>B: 메시지" 끝에 다음 메시지/키워드가 붙어 있으면 개행
    .replace(
      /(:[^\n]*?)(?=\s*(?:[A-Za-z_][\w-]*\s*(?:-{1,2}(?:>>|>)|-{1,2}(?:x|X)|-{1,2}(?:o|O)|\*|—)|Note\b|alt\b|opt\b|loop\b|par\b|rect\b|critical\b|end\b))/g,
      '$1\n'
    )
    // 2) 'end' 뒤에 뭔가 붙어 있으면 개행
    .replace(/(^|\n)\s*(end)\s*(?=\S)/gi, '$1$2\n')
    // 3) 제어 키워드 앞 경계 보강
    .replace(/([^\n])\s*(?=(Note|alt|opt|loop|par|rect|critical|end)\b)/g,
      (m, prev) => (/\n$/.test(prev) ? m : prev + '\n'));
}
