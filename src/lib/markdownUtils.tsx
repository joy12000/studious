// 안전한 후보정: Flowchart/Graph에만, 최소한으로
const FLOW_HEADER_RE = /^(graph|flowchart)\b/i;
const ANY_HEADER_RE =
  /^(graph|flowchart|sequenceDiagram|gantt|pie|erDiagram|journey|classDiagram|stateDiagram(?:-v2)?|gitGraph|mindmap|timeline|quadrantChart|sankey|requirementDiagram|xychart-beta)\b/i;

// 라벨에서 HTML 대신 리터럴 줄바꿈을 쓰는 경우(= htmlLabels:false 설정일 때)만 true로 두세요.
const USE_LITERAL_N = true;

const SPECIAL_CHARS_REGEX = /[(),;:]/;
const MERMAID_KEYWORDS = new Set([
  'graph','subgraph','end','style','classdef','linkstyle','click',
  'flowchart','sequencediagram','gantt','pie','statediagram','erdiagram',
  'journey','requirementdiagram','gitgraph','mindmap','timeline','quadrantchart','sankey'
]);

export function normalizeMermaidCode(code: string): string {
  if (!code) return code;

  // 0) 다이어그램 타입 판단: flowchart/graph만 손댄다
  const firstLine = code.trimStart().split('\n')[0].trim();
  const diagramHeader =
    (ANY_HEADER_RE.test(firstLine) ? firstLine.match(ANY_HEADER_RE)![1] : null);

  if (!diagramHeader || !FLOW_HEADER_RE.test(diagramHeader)) {
    // flowchart/graph가 아니면 그대로 반환 (sequence/gantt/pie 등 무터치)
    return code;
  }

  const lines = code.split('\n');
  const out: string[] = [];

  for (let raw of lines) {
    let line = raw;

    // 1) 주석 통일 (//, # → %%)
    if (/^\s*\/\//.test(line)) {
      out.push(line.replace(/^(\s*)\/\//, '$1%%'));
      continue;
    }
    if (/^\s*#/.test(line)) {
      out.push(line.replace(/^(\s*)#/, '$1%%'));
      continue;
    }

    // 2) <br> → 리터럴 \n (단, htmlLabels:false일 때만 의미 있음)
    if (USE_LITERAL_N) {
      line = line.replace(/<br\s*\/?>/gi, '\\n');
    }

    // 3) 화살표 자잘한 오타 수선(빈칸 제거 위주)
    line = line.replace(/-{3}\s+>/g, '--->');   // --- >
    line = line.replace(/-\s*-\s*>/g, '-->');   // - ->
    line = line.replace(/-\s*\.->/g, '-.->');   // - .->

    // 4) subgraph 제목에 공백이 있으면 따옴표 보강(이미 따옴표 있으면 건드리지 않음)
    if (/^\s*subgraph\b/i.test(line)) {
      const m = line.match(/^\s*subgraph\s+(.+)$/i);
      if (m) {
        const title = m[1].trim();
        if (title && !/^".+"$/.test(title) && /\s/.test(title)) {
          line = line.replace(/^\s*subgraph\s+.+$/i, `subgraph "${title.replace(/"/g, '&quot;')}"`);
        }
      }
      out.push(line);
      continue;
    }

    // 5) 노드 정의: 괄호 모양 보존, 라벨만 안전하게 따옴표 처리
    //    id + 여는 괄호 [ [[ ( (( { {{ {>  를 인식
    const nodeOpenRe = /^(\s*)([A-Za-z_][\w-]*)(\s*)(\[\[?|\(\(?|\{\{?|\{>)/;
    const nodeM = line.match(nodeOpenRe);
    if (nodeM) {
      const [_, lead, id, ws, openTok] = nodeM;
      const CLOSE: Record<string,string> = { '[':']','[[':']]','(' :')','((':'))','{':'}','{{':'}}','{>':'}>' };
      const closeTok = CLOSE[openTok] ?? ']';

      // 내용/테일 분리
      const start = nodeM[0].length;
      const rest = line.slice(start);
      const end = rest.indexOf(closeTok);
      if (end >= 0) {
        let content = rest.slice(0, end);
        let tail    = rest.slice(end + closeTok.length);

        const wasQuoted = content.startsWith('"') && content.endsWith('"');
        let inner = wasQuoted ? content.slice(1, -1) : content;

        // 라벨 안의 " → &quot; 이스케이프
        const innerEsc = inner.replace(/"/g, '&quot;');

        const needsQuotes =
          /\s/.test(innerEsc) ||
          SPECIAL_CHARS_REGEX.test(innerEsc) ||
          MERMAID_KEYWORDS.has(innerEsc.trim().toLowerCase()) ||
          /\\n/.test(innerEsc);

        const safeContent = needsQuotes ? `"${innerEsc}"` : innerEsc;

        // tail 앞에 명령/새 노드가 바로 붙는 경우 개행 추가(파서 충돌 방지)
        if (tail && /^\s*(subgraph|style|linkStyle|classDef|click|direction|[A-Za-z_][\w-]*\s*(\[\[?|\(\(?|\{\{?|\{>))/.test(tail)) {
          tail = '\n' + tail.trimStart();
        }

        line = `${lead}${id}${ws}${openTok}${safeContent}${closeTok}${tail}`;
      }
      out.push(line);
      continue;
    }

    // 6) 엣지 라벨: “파이프 구문만” 보수 ( --|text|--> )
    //   → 이것만은 문서 예시와 동일해서 안전. 임의의 중간 텍스트 추정은 금지.
    line = line
      .replace(/--\s*\|([^|]+)\|\s*--/g, (_m, label) => `-- "${String(label).trim().replace(/"/g, '&quot;')}" --`)
      .replace(/--\s*\|([^|]+)\|\s*-->/g, (_m, label) => `-- "${String(label).trim().replace(/"/g, '&quot;')}" -->`);

    // 7) style / linkStyle 라인 다듬기 (세미콜론 제거, dasharray 공백→쉼표)
    if (/^\s*(style|linkStyle)\b/i.test(line)) {
      line = line.replace(/;+\s*$/, '');
      line = line.replace(/stroke-dasharray:\s*([\d\s]+)/gi, (_m, values) =>
        `stroke-dasharray:${String(values).trim().replace(/\s+/g, ',')}`
      );
    }

    out.push(line);
  }

  // ⚠️ 리터럴 \n은 그대로 둔다. (htmlLabels:false일 때 라벨 줄바꿈용)
  return out.join('\n');
}
