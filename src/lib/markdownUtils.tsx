/**
 * AI가 생성한 불안정한 Mermaid 코드를 렌더링 가능한 형태로 정규화합니다.
 * 1. <br> 태그를 실제 개행 문자로 변환합니다.
 * 2. 여러 줄이거나 특수문자가 포함된 노드 내용을 큰따옴표로 감싸줍니다.
 * 3. 공백이나 특수문자가 포함된 링크 텍스트를 큰따옴표로 감싸줍니다.
 * @param code AI가 생성한 Mermaid 코드 원본
 * @returns 정규화된 Mermaid 코드
 */
export function normalizeMermaidCode(code: string): string {
  // --- 1단계: 노드 정의 수정 ---
  const nodeRegex = /(\w+)(["'(\[{>])([\s\S]+?)(["')\]}>])/g;
  let normalizedCode = code.replace(nodeRegex, (match, nodeId, startBracket, content, endBracket) => {
    let newContent = content.replace(/<br\s*\/?>/gi, '\n').trim();
    
    // 내용에 줄바꿈이나 특정 특수문자가 있고, 따옴표로 감싸여 있지 않다면 감싸줍니다.
    if ((newContent.includes('\n') || /[(),]/.test(newContent)) && startBracket !== '"') {
      newContent = newContent.replace(/"/g, '&quot;');
      return `${nodeId}["${newContent}"]`;
    }
    
    // 이미 따옴표로 감싸져 있었다면 내용만 업데이트합니다.
    if (startBracket === '"') {
        return `${nodeId}["${newContent}"]`;
    }

    return `${nodeId}${startBracket}${newContent}${endBracket}`;
  });

  // --- 2단계: 링크 텍스트 수정 ---
  // 정규식: 화살표(--> 등) 뒤에 따옴표 없이 공백을 포함하는 텍스트가 오는 경우를 찾습니다.
  const linkRegex = /(-->|---|--)\s+([^"\s][^"]*?\s[^"]*?)\s+(-->|---|--)/g;
  normalizedCode = normalizedCode.replace(linkRegex, (match, startArrow, content, endArrow) => {
      const newContent = content.trim().replace(/"/g, '&quot;');
      return `${startArrow} "${newContent}" ${endArrow}`;
  });

  return normalizedCode;
}