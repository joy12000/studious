/**
 * Mermaid Normalize/Sanitize (flowchart-safe, multi-diagram aware)
 * - 1) 다이어그램 타입 감지(명시/추론)
 * - 2) 타입별 보수적 정규화
 * - 3) flowchart/graph 계열에만 공격적 보정(노드/엣지/서브그래프/헤더 보충)
 */

type Direction = 'TB' | 'TD' | 'BT' | 'LR' | 'RL';
type DiagramHeader =
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

interface NormalizeOptions {
  defaultFlowDirection?: Direction;      // flowchart/graph 기본 방향
  wrapInCodeFence?: boolean;             // 결과를 ```mermaid 펜스로 감쌀지
  attachWarningsAsComments?: boolean;    // 경고를 %%로 붙일지
  enableHeaderAutofillForNonFlow?: boolean; // sequence 등에도 헤더 자동보충 허용(기본 false: 보수적)
}

const DEFAULT_OPTS: NormalizeOptions = {
  defaultFlowDirection: 'TB',
  wrapInCodeFence: false,
  attachWarningsAsComments: false,
  enableHeaderAutofillForNonFlow: false,
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
const INVISIBLE_CHARS = /[\u200B-\u200D\uFEFF]/g;
const NBSP = /\u00A0/g;

/** 공개 API */
export function normalizeMermaidCode(input: string, opts: NormalizeOptions = {}): string {
  const O = { ...DEFAULT_OPTS, ...opts };

  // 0) 래퍼 제거 + 숨은 문자 정리
  let code = stripFencesAndHtml((input || '').trim())
    .replace(/^\uFEFF/, '')
    .replace(INVISIBLE_CHARS, '')
    .replace(NBSP, ' ')
    .trim();

  if (!code) {
    const base = `graph ${O.defaultFlowDirection}`;
    return O.wrapInCodeFence ? fence(base) : base;
  }

  // 1) 멀티라인 주석 → %% 라인 주석화
  code = code.replace(/\/\*([\s\S]*?)\*\//g, (_m, body) =>
    body.split('\n').map(s => '%% ' + s.trim()).join('\n')
  );

  // 2) 라인 분해 + 순회 준비
  const rawLines = code.split(/\r?\n/);
  const lines = rawLines.map(s => s.trim()).filter(Boolean);

  // 3) 다이어그램 헤더 감지(명시)
  const detectExplicit = detectExplicitHeader(lines);
  let header: DiagramHeader = detectExplicit?.header ?? 'unknown';
  let headerSeen = !!detectExplicit;

  // 4) 명시 헤더 없으면 “약한 추론” (보수적)
  if (!headerSeen) {
    header = inferDiagramHeader(lines);
  }

  const warnings: string[] = [];

  // 5) 타입별 정규화 파이프라인
  let out: string[] = [];

  if (FLOW_HEADERS.has(header)) {
    // ===== flowchart/graph 계열 =====
    const result = normalizeFlowchartLike(lines, {
      headerSeen,
      defaultDir: O.defaultFlowDirection!,
    });
    out = result.lines;
    headerSeen = result.headerSeen;
    warnings.push(...result.warnings);

    // 헤더가 끝내 없고 flowchart 특성이 강하면 보수적 한도 내에서만 삽입
    if (!headerSeen && result.shouldAutofillHeader) {
      out.unshift(`graph ${O.defaultFlowDirection}`);
      headerSeen = true;
      warnings.push('Inserted default "graph" header for flowchart-like content.');
    }

  } else if (NON_FLOW_HEADERS.has(header)) {
    // ===== 비-flowchart 계열: 매우 보수적 정리만 =====
    const result = normalizeNonFlowMinimal(lines, header, {
      enableHeaderAutofill: O.enableHeaderAutofillForNonFlow,
    });
    out = result.lines;
    // 비-flow에서는 기본적으로 자동 헤더 삽입 안 함(옵션으로만)
    if (result.warning) warnings.push(result.warning);

  } else {
    // ===== 알 수 없음: 최대 보수 모드 =====
    const result = normalizeUnknownVeryConservative(lines);
    out = result.lines;
    if (result.seemsFlowLike) {
      // flowchart signature가 뚜렷할 때만(노드/엣지 패턴 다수) 헤더 삽입
      out.unshift(`graph ${O.defaultFlowDirection}`);
      warnings.push('No header found; inferred flowchart. Inserted "graph" header.');
    } else {
      // 절대 헤더 삽입하지 않음
      warnings.push('No explicit header and type unknown; skipped header insertion.');
    }
  }

  // 라벨 내부 줄바꿈은 \n(리터럴)로 유지해야 Mermaid가 줄바꿈 처리합니다.
  let final = out.join('\n');

  // 경고를 주석으로 첨부(옵션)
  if (O.attachWarningsAsComments && warnings.length) {
    final = ['%% WARN: ' + warnings.join(' | '), final].join('\n');
  }

  return O.wrapInCodeFence ? fence(final) : final;
}

/* ================= 내부 유틸/로직 ================= */

function fence(s: string) {
  return '```mermaid\n' + s + '\n```';
}

function stripFencesAndHtml(s: string): string {
  s = s.trim();
  const fenceMatch = s.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();
  const htmlMatch = s.match(/<div[^>]*class=["']?mermaid["']?[^>]*>([\s\S]*?)<\/div>/i);
  if (htmlMatch) return htmlMatch[1].trim();
  return s;
}

function detectExplicitHeader(lines: string):
  | { header: DiagramHeader; index: number }
  | null
{
  for (let i = 0; i < lines.length; i++) {
    const L = stripComment(lines[i]);
    if (!L) continue;
    // flowchart/graph + 방향
    if (/^(graph|flowchart)\b/i.test(L)) return { header: L.split(/\s+/)[0] as DiagramHeader, index: i };
    // 기타 헤더
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
  // 강한 힌트가 있으면 flowchart/sequence를 추정
  let flowHits = 0;
  let seqHits = 0;

  for (const raw of lines) {
    const L = stripComment(raw);
    if (!L) continue;

    // flowchart signature: ID[...] or A -- B, A -.-> B, subgraph 등
    if (/^[A-Za-z_][\w-]*\s*(\[\[?|\(\(?|\{\{?|\{>)/.test(L)) flowHits++;
    if (/\bsubgraph\b/i.test(L)) flowHits++;
    if (/-->|-{2,3}|-\.->/.test(L)) flowHits++;

    // sequence signature: actor/participant/message/Note/alt/opt/loop
    if (/^\s*(actor|participant)\b/i.test(L)) seqHits++;
    if (/\-\>\>|\-\>|\<\<\-/.test(L) && /:/.test(L)) seqHits++;
    if (/^\s*Note\b/i.test(L)) seqHits++;
    if (/^\s*(alt|opt|loop|par|rect|critical)\b/i.test(L)) seqHits++;
  }

  if (flowHits >= 2 && flowHits >= seqHits + 1) return 'flowchart';
  if (seqHits >= 2 && seqHits >= flowHits + 1) return 'sequenceDiagram';
  return 'unknown';
}

function stripComment(line: string): string {
  if (/^%%/.test(line)) return '';
  return line.replace(/\s*;+\s*$/, ''); // 말미 세미콜론 제거
}

/* ---------- flowchart 파이프라인 ---------- */

function normalizeFlowchartLike(
  lines: string[],
  opts: { headerSeen: boolean; defaultDir: Direction }
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

    // <br> → \n (후단에서 실제 개행으로 복원)
    line = line.replace(/<br\s*\/?>/gi, '\\n');

    // subgraph 제목 인용 및 균형
    if (/^subgraph\b/i.test(line)) {
      const m = line.match(/^subgraph\s+(.+)$/i);
      const title = m ? m[1].trim() : '';
      if (title) {
        if (title.startsWith('"') && title.endsWith('"')) {
          out.push(`subgraph ${title}`);
        } else if (/\s/.test(title)) {
          out.push(`subgraph "${escapeQuotes(title)}"`);
        } else {
          out.push(`subgraph ${title}`);
        }
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

    // 노드 정의(대괄호/소괄호/중괄호 등) 내부 인용 보정
    const beforeNode = line;
    line = normalizeFlowNodeDefinition(line);
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

  // 헤더가 없고 flowchart signature가 충분하면 헤더 보충 권고
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

function normalizeFlowEdgeLabels(line: string): string {
  // |label| → "label"
  line = line.replace(/--\s*\|([^|]+)\|\s*--/g, (_m, label) => `-- "${escapeQuotes(label.trim())}" --`);
  line = line.replace(/--\s*\|([^|]+)\|\s*-->/g, (_m, label) => `-- "${escapeQuotes(label.trim())}" -->`);
  line = line.replace(/-\.->\s*\|([^|]+)\|\s*([-\w>]+)/g, (_m, label, tail) => `-. "${escapeQuotes(label.trim())}" .-> ${tail}`);

  // 공백/특수문자/예약어 포함 텍스트 자동 인용
  line = line.replace(
    /(--|-{3}|-\.->)\s*([^\s"->][^->]*?)\s*(-->|--|-\.\->)/g,
    (_m, left, text, right) => {
      const t = text.trim();
      if (!t) return `${left} ${right}`;
      if (needsQuotes(t)) return `${left} "${escapeQuotes(t)}" ${right}`;
      return `${left} ${t} ${right}`;
    }
  );
  return line;
}

function normalizeFlowNodeDefinition(line: string): string {
  // 라인 시작: ID + 여는 토큰
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

  const rawContent = content.replace(/\\n/g, '\n');

  const shouldQuote =
    /\n/.test(rawContent) ||
    SPECIAL_CHARS_REGEX.test(rawContent) ||
    MERMAID_KEYWORDS.has(rawContent.trim().toLowerCase()) ||
    /^\s|\s$/.test(rawContent);

  const inner = shouldQuote && !(rawContent.startsWith('"') && rawContent.endsWith('"'))
    ? `"${escapeQuotes(rawContent)}"`
    : rawContent;

  return `${id}${ws}${open}${inner}${close}${tail}`;
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

    // 헤더가 있으면 대소문자 표준화만
    if (new RegExp('^' + escapeReg(header) + '\\b', 'i').test(line)) {
      if (!sawHeader) {
        out.push(header); // 표기 통일
        sawHeader = true;
      }
      continue; // 중복 헤더는 무시
    }

    // 공통 정리: 말미 세미콜론 제거, <br> → \n (메시지 텍스트를 줄바꿈으로 보존)
    line = line.replace(/;+\s*$/,'').replace(/<br\s*\/?>/gi, '\\n');

    // !!! 중요: 비-flow에서는 화살표/노드/스타일 보정 "금지"
    // sequenceDiagram 예: Alice->>John: Hello! 를 절대 건드리지 않음

    out.push(line);
  }

  if (!sawHeader && opts.enableHeaderAutofill) {
    // 사용자가 명시적으로 허용한 경우에만 자동 보충
    out.unshift(header);
    return { lines: out, warning: `Inserted missing "${header}" header (opt-in).` };
  }

  return { lines: out };
}

/* ---------- 불명(최대 보수) ---------- */

function normalizeUnknownVeryConservative(lines: string[]) {
  const out: string[] = [];
  let flowHits = 0;

  for (let raw of lines) {
    let line = raw.trim();
    if (!line) continue;

    if (line.startsWith('//') || line.startsWith('#')) {
      out.push('%% ' + line.replace(/^\/\/|^#/, '').trim());
      continue;
    }

    line = line.replace(/;+\s*$/,'').replace(/<br\s*\/?>/gi, '\\n');

    // 흐름도 시그니처만 카운트(적용은 안 함)
    if (/^[A-Za-z_][\w-]*\s*(\[\[?|\(\(?|\{\{?|\{>)/.test(line)) flowHits++;
    if (/-->|-{2,3}|-\.->/.test(line)) flowHits++;
    if (/\bsubgraph\b/i.test(line)) flowHits++;

    out.push(line);
  }

  return { lines: out, seemsFlowLike: flowHits >= 2 };
}

/* ---------- 공통 ---------- */

function needsQuotes(text: string): boolean {
  return /\s/.test(text) || SPECIAL_CHARS_REGEX.test(text) || MERMAID_KEYWORDS.has(text.toLowerCase());
}
function escapeQuotes(s: string): string { return s.replace(/"/g, '&quot;'); }
function escapeReg(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
