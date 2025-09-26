// src/lib/markdownUtils.ts
/* eslint-disable no-useless-escape */

/**
 * markdownUtils.ts
 * - ```mermaid 블록 정규화(보수/공격 혼합)
 * - htmlLabels:false 전제: <br> → \n(리터럴), \n 실개행 치환 금지
 * - 타입별 “세이프티 개행 보강”: flow/sequence 경계 붙음 자동 분리
 * - 내부 %%{init:...}%% 제거(전역 init과 충돌 방지)
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
  defaultFlowDirection?: Direction;
  wrapInCodeFence?: boolean;
  attachWarningsAsComments?: boolean;
  enableHeaderAutofillForNonFlow?: boolean;
  stripQuotedSubgraphTitle?: boolean;
  stripInlineInitDirective?: boolean;
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

const MERMAID_KEYWORDS = new Set([
  'graph','subgraph','end','style','classdef','linkstyle','click',
  'flowchart','sequencediagram','gantt','pie','statediagram','statediagram-v2',
  'erdiagram','journey','requirementdiagram','gitgraph','mindmap','timeline',
  'quadrantchart','sankey','xychart-beta','classdiagram'
]);

const SPECIAL_CHARS_REGEX = /[(),;:]/;
const INVISIBLE_CHARS = /[\u200B-\u200D\uFEFF]/g;
const NBSP = /\u00A0/g;

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export function normalizeMermaidInMarkdown(markdown: string, opts: NormalizeOptions = {}): string {
  if (!markdown) return markdown;
  return markdown.replace(/```mermaid\s*([\s\S]*?)```/gi, (_m, inner) => {
    const fixed = normalizeMermaidCode(String(inner || ''), opts);
    return '```mermaid\n' + fixed + '\n```';
  });
}

export function normalizeMermaidCode(input: string, opts: NormalizeOptions = {}): string {
  const O = { ...DEFAULT_OPTS, ...opts };

  let code = (input || '')
    .replace(/^\uFEFF/, '')
    .replace(INVISIBLE_CHARS, '')
    .replace(NBSP, ' ')
    .trim();

  if (!code) return `graph ${O.defaultFlowDirection}`;

  // /* ... */ → %% ...
  code = code.replace(/\/\*([\s\S]*?)\*\//g, (_m, body) =>
    body.split('\n').map(s => '%% ' + s.trim()).join('\n')
  );

  const rawLines = code.split(/\r?\n/);
  let lines = rawLines.map(s => s.trim()).filter(Boolean);

  if (O.stripInlineInitDirective) {
    lines = lines.filter(l => !/^%%\s*\{init:/i.test(l));
  }

  const explicit = detectExplicitHeader(lines);
  let header: DiagramHeader = explicit?.header ?? 'unknown';
  let headerSeen = !!explicit;

  if (!headerSeen) header = inferDiagramHeader(lines);

  const warnings: string[] = [];
  let resultLines: string[] = [];

  if (FLOW_HEADERS.has(header)) {
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
    const r = normalizeNonFlowMinimal(lines, header, {
      enableHeaderAutofill: O.enableHeaderAutofillForNonFlow!,
    });
    resultLines = r.lines;
    if (r.warning) warnings.push(r.warning);
  } else {
    const r = normalizeUnknownVeryConservative(lines);
    resultLines = r.lines;
    if (r.seemsFlowLike && !r.hasClassOrStateHints) {
      resultLines.unshift(`graph ${O.defaultFlowDirection}`);
      warnings.push('No header found; inferred flowchart. Inserted "graph" header.');
    }
  }

  let final = resultLines.join('\n');

  // 타입별 세이프티 개행 보강
  if (header === 'sequenceDiagram') {
    final = enforceSafetyNewlinesSequence(final);
  } else {
    final = enforceSafetyNewlinesFlow(final);
  }

  // ▷ 추가: 라인 시작에 튀어나온 중복 클로저 제거 + 고아 세미콜론 제거
  final = stripDuplicateClosersAtLineStart(final);
  final = stripLoneSemicolons(final);

  if (opts.attachWarningsAsComments && warnings.length) {
    final = ['%% WARN: ' + warnings.join(' | '), final].join('\n');
  }
  return opts.wrapInCodeFence ? fence(final) : final;
}

/* -------------------------------------------------------------------------- */
/* Internals                                                                  */
/* -------------------------------------------------------------------------- */

function fence(s: string) { return '```mermaid\n' + s + '\n```'; }
function escapeReg(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function stripComment(line: string): string {
  if (/^%%/.test(line)) return '';
  return line.replace(/\s*;+\s*$/, '');
}

function detectExplicitHeader(lines: string):
  | { header: DiagramHeader; index: number } | null {
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
  let flowHits = 0, seqHits = 0, classHits = 0, stateHits = 0;
  for (const raw of lines) {
    const L = stripComment(raw);
    if (!L) continue;
    if (/^[A-Za-z_][\w-]*\s*(\[\[?|\(\(?|\{\{?|\{>)/.test(L)) flowHits++;
    if (/(^|[^<])(-->|-\.->|<-->)/.test(L)) flowHits++;
    if (/\bsubgraph\b/i.test(L)) flowHits++;

    if (/^\s*(actor|participant)\b/i.test(L)) seqHits++;
    if (/-{1,2}>{1,2}[^:]*:/.test(L)) seqHits++;

    if (/\<\|--|--\|>|\*--|o--|--\*|--o/.test(L)) classHits++;
    if (/^\s*\[\*\]\s*-->|-->\s*\[\*\]/.test(L) || /^\s*state\s+/i.test(L)) stateHits++;
  }
  if (classHits >= 2 && classHits >= flowHits + seqHits) return 'classDiagram';
  if (stateHits >= 2 && stateHits >= flowHits + seqHits) return 'stateDiagram';
  if (flowHits  >= 2 && flowHits  >= seqHits + 1)      return 'flowchart';
  if (seqHits   >= 2 && seqHits   >= flowHits + 1)     return 'sequenceDiagram';
  return 'unknown';
}

/* ---------- flowchart normalize ---------- */

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

    if (line.startsWith('//') || line.startsWith('#')) {
      out.push('%% ' + line.replace(/^\/\/|^#/, '').trim());
      continue;
    }

    const hdr = parseAndNormalizeFlowHeader(line);
    if (hdr) {
      if (!headerSeen) out.push(`${hdr.header} ${hdr.direction}`);
      headerSeen = true;
      continue;
    }

    // <br> → \n(리터럴)
    line = line.replace(/<br\s*\/?>/gi, '\\n');

    // subgraph
    if (/^subgraph\b/i.test(line)) {
      const m = line.match(/^subgraph\s+(.+)$/i);
      const titleRaw = m ? m[1].trim() : '';
      if (titleRaw) {
        let title = titleRaw;
        if (opts.stripQuotedSubgraphTitle && /^".+"$/.test(titleRaw)) {
          title = titleRaw.replace(/^"(.+)"$/, '$1');
        } else if (!opts.stripQuotedSubgraphTitle && /\s/.test(titleRaw) && !/^".+"$/.test(titleRaw)) {
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

    const beforeArrows = line;
    line = normalizeFlowArrows(line);
    if (line !== beforeArrows) sawFlowSignature = true;

    const beforeLabels = line;
    line = normalizeFlowEdgeLabels(line);
    if (line !== beforeLabels) sawFlowSignature = true;

    const beforeNode = line;
    line = normalizeFlowNodeDefinition(line, { transformParenMultilineToBracket: opts.transformParenMultilineToBracket });
    if (line !== beforeNode) sawFlowSignature = true;

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

  while (subgraphDepth > 0) {
    out.push('end'); subgraphDepth--;
    warnings.push('Inserted missing "end" for subgraph.');
  }

  const shouldAutofillHeader = !headerSeen && sawFlowSignature;
  return { lines: out, headerSeen, shouldAutofillHeader, warnings };
}

function parseAndNormalizeFlowHeader(line: string):
  | { header: 'graph' | 'flowchart'; direction: Direction } | null {
  const m = line.match(/^(graph|flowchart)\s*[:\-]?\s*([A-Za-z]{2})\b/i);
  if (!m) return null;
  const header = m[1].toLowerCase() as 'graph' | 'flowchart';
  let dir = m[2].toUpperCase() as Direction;
  if (dir === 'TD') dir = 'TB';
  if (!['TB','BT','LR','RL'].includes(dir)) dir = 'TB';
  return { header, direction: dir };
}

function normalizeFlowArrows(line: string): string {
  line = line.replace(/-{3}\s+>/g, '--->');
  line = line.replace(/-\s*\.->/g, '-.->');
  line = line.replace(/-\s*-\s*>/g, '-->');
  line = line.replace(/-\s*>/g, '->');
  return line;
}

function needsQuotes(text: string): boolean {
  return /\s/.test(text) || SPECIAL_CHARS_REGEX.test(text) || MERMAID_KEYWORDS.has(text.toLowerCase());
}
function escapeQuotes(s: string): string { return s.replace(/"/g, '&quot;'); }

/** 엣지 라벨 보정 (flow 전용) */
function normalizeFlowEdgeLabels(line: string): string {
  line = line.replace(/--\s*\|([^|]+)\|\s*--/g, (_m, label) => `-- "${escapeQuotes(label.trim())}" --`);
  line = line.replace(/--\s*\|([^|]+)\|\s*-->/g, (_m, label) => `-- "${escapeQuotes(label.trim())}" -->`);
  line = line.replace(/-\.->\s*\|([^|]+)\|\s*([-\w>]+)/g, (_m, label, tail) => `-. "${escapeQuotes(label.trim())}" .-> ${tail}`);

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
 * - 라벨에 " 가 하나라도 있으면 () → []로 강제 전환 (")") 패턴 차단  ← ★ 추가
 * - 라벨은 필요 시 항상 "..."로 감싸고, 내부 " 는 &quot; 로 이스케이프  ← ★ 강화
 * - 닫힘 괄호 뒤 tail이 명령/식별자 등으로 시작하면 즉시 줄바꿈 삽입  ← ★ 유지
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
  let tail = endIdx === -1 ? '' : rest.slice(endIdx + close.length);

  // 내용 파싱 (겉따옴표 제거)
  const wasQuoted = content.startsWith('"') && content.endsWith('"');
  let inner = wasQuoted ? content.slice(1, -1) : content;

  const isMultiline = /\\n/.test(inner) || /\n/.test(inner);
  const hasQuotedChar = /"|&quot;|&#34;|&#x22;/i.test(inner);

  // () 노드에서 멀티라인 또는 " 가 포함되면 [] 로 강제 전환  ← ★ 핵심
  let effOpen = open;
  let effClose = close;
  const isParenOpen = (open === '(' || open === '((');
  if ((opt.transformParenMultilineToBracket && isMultiline) || (isParenOpen && hasQuotedChar)) {
    effOpen = open.startsWith('((') ? '[[' : '[';
    effClose = effOpen === '[[' ? ']]' : ']';
  }

  // 최종 라벨: 내부 " → &quot; , 그리고 필요 시 "..."로 감싸기
  const innerEscaped = inner.replace(/"/g, '&quot;');
  const mustQuote =
    wasQuoted || isMultiline || needsQuotes(inner) || hasQuotedChar || /^\s|\s$/.test(innerEscaped);

  const normalizedInner = mustQuote ? `"${innerEscaped}"` : innerEscaped;

  // 닫힘 뒤 tail이 명령/식별자 등으로 바로 시작하면 바로 줄바꿈
  if (tail) {
    const t = tail;
    const startsWithCmdOrId =
      /^\s*(?:subgraph|style|linkStyle|classDef|click|direction)\b/i.test(t) ||
      /^\s*[A-Za-z_][\w-]*\s*(?:\[\[?|\(\(?|\{\{?|\{>)/.test(t);
    if (startsWithCmdOrId) tail = '\n' + t.trim();
  }

  return `${id}${ws}${effOpen}${normalizedInner}${effClose}${tail}`;
}

/* ---------- Line-start cleanup (신규) ---------- */
/** 라인 시작의 중복 클로저 제거: `") --`, `]linkStyle 1 ...`, `"}> style ...` 등 */
function stripDuplicateClosersAtLineStart(s: string): string {
  return s
    // 연속된 클로저(전 라인 끝 + 다음 라인 시작) → 시작 쪽 클로저 제거
    .replace(/(^|\n)\s*["']?(\]|\)|\}>)(?=\s*(?:--|-\.)|(?:subgraph|style|linkStyle|classDef|click|direction)\b|[A-Za-z_])/gi, '$1')
    // 드물게 클로저만 라인에 남은 경우 제거
    .replace(/(^|\n)\s*["']?(\]|\)|\}>)\s*$/gm, '$1');
}

/** 고아 세미콜론만 있는 라인 제거 */
function stripLoneSemicolons(s: string): string {
  return s.replace(/(^|\n)\s*;\s*(?=$|\n)/g, '$1');
}

/* ---------- non-flow minimal ---------- */

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

    if (line.startsWith('//') || line.startsWith('#')) {
      out.push('%% ' + line.replace(/^\/\/|^#/, '').trim());
      continue;
    }

    if (new RegExp('^' + escapeReg(header) + '\\b', 'i').test(line)) {
      if (!sawHeader) out.push(header);
      sawHeader = true;
      continue;
    }

    line = line.replace(/;+\s*$/,'').replace(/<br\s*\/?>/gi, '\\n');
    out.push(line);
  }

  if (!sawHeader && opts.enableHeaderAutofill) {
    out.unshift(header);
    return { lines: out, warning: `Inserted missing "${header}" header (opt-in).` };
  }
  return { lines: out };
}

/* ---------- unknown conservative ---------- */

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

    if (/^[A-Za-z_][\w-]*\s*(\[\[?|\(\(?|\{\{?|\{>)/.test(line)) flowHits++;
    if (/(^|[^<])(-->|-\.->|<-->)/.test(line)) flowHits++;
    if (/\bsubgraph\b/i.test(line)) flowHits++;

    if (/\<\|--|--\|>|\*--|o--|--\*|--o/.test(line)) classOrState++;
    if (/^\s*\[\*\]\s*-->|-->\s*\[\*\]/.test(line) || /^\s*state\s+/i.test(line)) classOrState++;

    out.push(line);
  }
  return { lines: out, seemsFlowLike: flowHits >= 2, hasClassOrStateHints: classOrState > 0 };
}

/* ---------- Safety newlines (강화판) ---------- */

/** flowchart/graph: 경계 붙음 강제 분리 — linkStyle/style/classDef/click/direction, end, 닫힘괄호 */
function enforceSafetyNewlinesFlow(s: string): string {\n  return s\n    // direction 라인 뒤에 토큰 붙으면 개행\n    .replace(/(^|\\n)\\s*(direction\\s+(?:TB|TD|BT|LR|RL))\\s*(?=\\S)/gi, \'$1$2\\n\')\n\n    // end 뒤에 무언가 붙어 있으면 개행\n    .replace(/(^|\\n)\\s*(end)\\s*(?=(?:subgraph|style|linkStyle|classDef|click|direction|[A-Za-z_[(\\{]))/gi, \'$1$2\\n\')\n\n    // 특화: \"]linkStyle\" / \'\"]linkStyle\' 케이스 명시적으로 끊기\n    .replace(/\"\\]\\s*(?=(linkStyle|style|classDef|click|direction)\\b)/gi, \'\"]\\n\')\n    .replace(/\\]\\s*(?=(linkStyle|style|classDef|click|direction)\\b)/gi, \']\\n\')\n\n    // 🔥 추가: \'\"]\' 뒤에 \"새 노드 시작\"이 바로 오면 개행 (예: \"]D_Data[\")\n    .replace(/\"\\](?=\\s*[A-Za-z_][\\w-]*\\s*(\\[\\[?|\\(\\(?|\\{\\{?|\\{>))/g, \'\"\]\\n\')\n\n    // 닫힘 토큰 뒤에 \"새 노드 시작\"이 붙으면 확실히 개행\n    .replace(/(\\]|\\}|\\))(?=\\s*[A-Za-z_][\\w-]*\\s*(\\[\\[?|\\(\\(?|\\{\\{?|\\{>))/g, \'$1\\n\')\n    // 그 외 닫힘 뒤에 토큰이 붙는 일반 케이스(화살표/태그 제외)도 개행\n    .replace(/(\\]|\\}|\\))(?=(?:(?!\\s*(?:-|\\.|<|\\)|\\]|\\}|$))\\S))/g, \'$1\\n\')\n\n    // 명령 키워드 앞에 개행이 없으면 개행\n    .replace(/([^\\n])\\s*(?=(subgraph|style|linkStyle|classDef|click|direction)\\b)/gi,\n      (m, prev) => (/\\n$/.test(prev) ? m : prev + \'\\n\'));\n}\n\n/** sequenceDiagram: 메시지(: …) 끝과 다음 메시지/블록 경계를 분리 */\nfunction enforceSafetyNewlinesSequence(s: string): string {\n  return s\n    // 메시지(: ... ) 다음에 \"참가자(+옵션 공백)+화살표\"가 붙으면,\n    // 화살표만 새 줄로 보내지 말고 \"참가자+화살표\"를 통째로 다음 줄로 이동\n    //  ex)  \"...소진R->>R: 다음\"  →  \"...소진\\nR->>R: 다음\"\n    .replace(\n      /(:[^\\n]*?)\\s*((?:[A-Za-z_][\\w-]*\\s*)?(?:-{1,2}(?:>>|>|x|X)|-{1,2}(?:o|O)|\\*|—))/g,\n      \'$1\\n$2\'\n    )\n    // 블록 키워드 앞 경계 보강\n    .replace(/([^\\n])\\s*(?=(Note|alt|opt|loop|par|rect|critical|end)\\b)/g,\n      (m, prev) => (/\\n$/.test(prev) ? m : prev + \'\\n\'))\n    // end 뒤에 토큰이 붙으면 개행\n    .replace(/(^|\\n)\\s*(end)\\s*(?=\\S)/gi, \'$1$2\\n\');\n}
