/**
 * AI가 생성한, 잠재적 오류를 포함한 Mermaid 코드를
 * 렌더링 가능한 안정적인 형태로 정규화(Normalize)하고 정리(Sanitize)합니다.
 * 이 함수는 AI의 흔한 문법 실수 대부분을 자동으로 수정하는 안전망 역할을 합니다.
 */

// Mermaid 문법에서 특별한 의미를 갖는 예약어 목록
const MERMAID_KEYWORDS = new Set([
  'graph', 'subgraph', 'end', 'style', 'classDef', 'linkStyle', 'click',
  'flowchart', 'sequenceDiagram', 'gantt', 'pie', 'stateDiagram',
  'erDiagram', 'journey', 'requirementDiagram', 'gitGraph'
]);

// 노드 텍스트 안에 있을 경우 따옴표로 감싸야 하는 특수 문자 정규식
const SPECIAL_CHARS_REGEX = /[(),;:]/;

export function normalizeMermaidCode(code: string): string {
  // 0. 입력값의 앞뒤 공백을 모두 제거하고, 여러 줄의 코드를 처리하기 위해 배열로 분해합니다.
  const lines = code.trim().split('\n');
  const processedLines = [];

  for (const rawLine of lines) {
    let line = rawLine.trim();

    // 빈 줄은 완전히 무시합니다.
    if (!line) {
      continue;
    }

    // 1. 주석 문법 통일: 다른 주석 기호들을 Mermaid 공식 주석(%%)으로 변경합니다.
    if (line.startsWith('//') || line.startsWith('#')) {
      line = `%%${line.substring(2)}`;
    }
    // 여러 줄 주석(/* */)도 단일 라인 주석으로 변경
    if (line.startsWith('/*')) {
        line = `%%${line.replace(/\/\*|\*\//g, '')}`;
    }

    // 2. <br> 태그를 임시 개행 식별자(\\n)로 변환합니다.
    line = line.replace(/<br\s*\/?>/gi, '\\n');

    // 3. 잘못된 화살표/연결선 문법을 표준화합니다.
    line = line.replace(/---\s+>/g, '--->'); // 예: --- >  --> --->
    line = line.replace(/-\s*-\.->/g, '-.->'); // 예: - .-> --> -.->

    // 4. `graph` 또는 `flowchart` 정의 줄의 오류를 수정합니다.
    const directionMatch = line.match(/^(graph|flowchart)\s+(TB|TD|BT|LR|RL);?$/i);
    if (directionMatch) {
      line = `graph ${directionMatch[2]}`;
    }

    // 5. `subgraph` 제목의 따옴표 누락을 수정합니다.
    const subgraphMatch = line.match(/^(subgraph)\s+([^"]+)/);
    if (subgraphMatch && subgraphMatch[2].includes(' ')) {
      line = `subgraph "${subgraphMatch[2].trim()}"`;
    }

    // 6. 노드 정의의 따옴표 누락을 수정합니다. (가장 복잡한 부분)
    const nodeMatch = line.match(/^(\w+)(\[|\(|\{>|\{)([\s\S]+?)(\]|\)|\}>|\})/);
    if (nodeMatch) {
      const [fullMatch, nodeId, startBracket, content, endBracket] = nodeMatch;
      const needsQuotes = content.includes('\\n') ||
                          SPECIAL_CHARS_REGEX.test(content) ||
                          MERMAID_KEYWORDS.has(content.trim().toLowerCase());

      if (startBracket !== '"' && needsQuotes) {
        const escapedContent = content.replace(/"/g, '&quot;');
        line = `${nodeId}["${escapedContent}"]`;
      }
    }

    // 7. 링크 텍스트의 따옴표 누락을 수정합니다.
    const linkTextMatch = line.match(/(-->|---|--)\s*([^"]+?)\s*($|--|-->)/);
    if (linkTextMatch) {
        const [fullMatch, startArrow, content, endArrow] = linkTextMatch;
        if (content && (content.includes(' ') || SPECIAL_CHARS_REGEX.test(content))) {
            const escapedContent = content.trim().replace(/"/g, '&quot;');
            line = line.replace(content, `"${escapedContent}"`);
        }
    }

    // 8. style, linkStyle 명령어의 문법 오류를 수정합니다.
    if (line.startsWith('style') || line.startsWith('linkStyle')) {
      // 끝에 붙은 세미콜론 제거
      if (line.endsWith(';')) {
        line = line.slice(0, -1);
      }
      // stroke-dasharray의 공백을 쉼표로 변경
      line = line.replace(/stroke-dasharray:\s*([\d\s]+)/g, (sMatch, values) => {
        return `stroke-dasharray:${values.trim().replace(/\s+/g, ',')}`;
      });
    }

    processedLines.push(line);
  }

  // 임시 개행 식별자를 실제 개행 문자로 최종 복원합니다.
  return processedLines.join('\n').replace(/\\n/g, '\n');
}