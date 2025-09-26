/**
 * AI가 생성한, 잠재적 오류를 포함한 Mermaid 코드를
 * 렌더링 가능한 안정적인 형태로 정규화(Normalize)합니다.
 * 이 함수는 AI의 흔한 문법 실수 대부분을 자동으로 수정하는 안전망 역할을 합니다.
 */

// Mermaid 문법에서 특별한 의미를 갖는 예약어 목록
const MERMAID_KEYWORDS = new Set([
  'graph', 'subgraph', 'end', 'style', 'classDef', 'linkStyle', 'click',
  'flowchart', 'sequenceDiagram', 'gantt', 'pie', 'stateDiagram',
  'erDiagram', 'journey', 'requirementDiagram', 'gitGraph'
]);

export function normalizeMermaidCode(code: string): string {
  // 여러 줄로 된 코드를 처리하기 위해 한 줄씩 분해합니다.
  const lines = code.split('\n');
  const processedLines = [];

  for (const line of lines) {
    let processedLine = line.trim();

    // 1. <br> 태그를 실제 줄바꿈 문자로 변환 (전체 코드 대상)
    processedLine = processedLine.replace(/<br\s*\/?>/gi, '\\n');

    // 2. subgraph 제목의 따옴표 누락 수정
    // 예: subgraph My Subgraph --> subgraph "My Subgraph"
    const subgraphMatch = processedLine.match(/^(subgraph)\s+([^"]+)/);
    if (subgraphMatch && subgraphMatch[2].includes(' ')) {
      processedLine = `subgraph "${subgraphMatch[2].trim()}"`;
    }

    // 3. 노드 정의의 따옴표 누락 수정
    // 예: A(오류가 있는, 텍스트) --> A["오류가 있는, 텍스트"]
    // 예: B[end] --> B["end"] (키워드 충돌 방지)
    const nodeMatch = processedLine.match(/(\w+)(\[|\(|\{)(.+)(\]|\)|\})/);
    if (nodeMatch) {
      const [fullMatch, nodeId, startBracket, content, endBracket] = nodeMatch;
      const needsQuotes = content.includes('\\n') || 
                          /[(),]/.test(content) || 
                          MERMAID_KEYWORDS.has(content.trim().toLowerCase());

      if (needsQuotes) {
        // 내부 따옴표는 HTML 엔티티로 변환하여 오류 방지
        const escapedContent = content.replace(/"/g, '&quot;');
        processedLine = `${nodeId}["${escapedContent}"]`;
      }
    }

    // 4. 링크 텍스트의 따옴표 누락 수정
    // 예: -- 텍스트 -->  --> -- "텍스트" -->
    const linkTextMatch = processedLine.match(/(-->|---|--)\s*([^"]+?)\s*(-->|---|--)/);
    if (linkTextMatch && linkTextMatch[2].trim().includes(' ')) {
        const [fullMatch, startArrow, content, endArrow] = linkTextMatch;
        processedLine = processedLine.replace(content, `"${content.trim()}"`);
    }

    // 5. style, linkStyle 명령어의 문법 오류 수정
    if (processedLine.startsWith('style') || processedLine.startsWith('linkStyle')) {
      // 끝에 붙은 세미콜론 제거
      if (processedLine.endsWith(';')) {
        processedLine = processedLine.slice(0, -1);
      }
      // stroke-dasharray의 공백을 쉼표로 변경
      processedLine = processedLine.replace(/stroke-dasharray:\s*([\d\s]+)/g, (sMatch, values) => {
        return `stroke-dasharray:${values.trim().replace(/\s+/g, ',')}`;
      });
    }

    processedLines.push(processedLine);
  }

  // 줄바꿈이 변환된 경우(\n)를 실제 개행으로 복원
  return processedLines.join('\n').replace(/\\n/g, '\n');
}