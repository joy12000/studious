// src/lib/markdownUtils.ts

/**
 * AI가 생성한 불안정한 Mermaid 코드를 렌더링 가능한 형태로 정규화합니다.
 * - <br> 태그를 실제 개행 문자로 변환합니다.
 * - 여러 줄이거나 특수문자가 포함된 노드 정의를 큰따옴표로 감싸줍니다.
 * @param code AI가 생성한 Mermaid 코드 원본
 * @returns 정규화된 Mermaid 코드
 */
export function normalizeMermaidCode(code: string): string {
  // 정규식: 노드 ID와 괄호 종류, 그리고 그 안의 내용을 찾습니다.
  const nodeRegex = /(\w+)(["'(\[{>])([\s\S]+?)(["')\]}>])/g;
  
  // ✅ 1. 노드 이름에 사용될 수 있는 특수문자 목록을 정의합니다.
  const specialChars = /[(),]/;

  return code.replace(nodeRegex, (match, nodeId, startBracket, content, endBracket) => {
    // <br> 태그를 실제 줄바꿈(\n)으로 변경합니다.
    let newContent = content.replace(/<br\s*\/?>/gi, '\n').trim();
    
    // ✅ 2. 괄호 자체가 텍스트 내용인 경우(예: O(원점))를 제외하고,
    //    내용물에 줄바꿈이 있거나, 특수문자가 포함되어 있고,
    //    아직 따옴표로 감싸여 있지 않다면 감싸줍니다.
    if (startBracket !== '(' && (newContent.includes('\n') || specialChars.test(newContent)) && startBracket !== '"') {
      // 내용물 안의 따옴표가 있다면 HTML 엔티티로 변환하여 오류를 방지합니다.
      newContent = newContent.replace(/"/g, '&quot;');
      return `${nodeId}["${newContent}"]`;
    }
    
    // 이미 따옴표로 감싸져 있었다면, <br>만 변환된 내용으로 업데이트합니다.
    if (startBracket === '"') {
        return `${nodeId}["${newContent}"]`;
    }

    // 그 외의 경우는 최대한 원본 형식을 유지합니다.
    return `${nodeId}${startBracket}${newContent}${endBracket}`;
  });
}