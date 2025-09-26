/**
 * AI가 생성한 불안정한 Mermaid 코드를 렌더링 가능한 형태로 정규화합니다.
 * - <br> 태그를 실제 개행 문자로 변환합니다.
 * - 여러 줄이거나 특수문자/키워드가 포함된 노드/subgraph 내용을 큰따옴표로 감싸줍니다.
 * @param code AI가 생성한 Mermaid 코드 원본
 * @returns 정규화된 Mermaid 코드
 */
export function normalizeMermaidCode(code: string): string {
  // 1. <br> 태그를 먼저 실제 줄바꿈으로 변경합니다.
  let normalizedCode = code.replace(/<br\s*\/?>/gi, '\n');

  // 2. 여러 줄이거나 특수문자가 포함된 subgraph 제목을 따옴표로 감쌉니다.
  const subgraphRegex = /(subgraph)\s+([^"\n]+)/g;
  normalizedCode = normalizedCode.replace(subgraphRegex, (match, keyword, title) => {
    // 제목에 공백이 포함된 경우에만 따옴표를 추가합니다.
    if (/\s/.test(title.trim())) {
      return `${keyword} "${title.trim()}"`;
    }
    return match;
  });

  // 3. 여러 줄이거나 특수문자가 포함된 노드 내용을 따옴표로 감쌉니다.
  const nodeRegex = /(\w+)(["'(\[{>])([\s\S]+?)(["')\]}>])/g;
  normalizedCode = normalizedCode.replace(nodeRegex, (match, nodeId, startBracket, content, endBracket) => {
    const newContent = content.trim();
    // 내용에 줄바꿈이나 특정 특수문자가 있고, 아직 따옴표로 감싸여 있지 않다면 감싸줍니다.
    if ((newContent.includes('\n') || /[(),]/.test(newContent)) && startBracket !== '"') {
      const escapedContent = newContent.replace(/"/g, '&quot;');
      return `${nodeId}["${escapedContent}"]`;
    }
    if (startBracket === '"') {
      return `${nodeId}["${newContent}"]`;
    }
    return `${nodeId}${startBracket}${newContent}${endBracket}`;
  });

  return normalizedCode;
}