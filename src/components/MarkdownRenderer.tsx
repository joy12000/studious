import React from 'react';
import { marked } from 'marked';
import { InlineMath, BlockMath } from 'react-katex';

// ✨ 이 설정이 포함되어 있는지 확인해주세요.
marked.use({
  // ... (다른 설정들)
  breaks: true, // 한 줄 띄어쓰기(single newline)를 <br>로 변환
  gfm: true,    // GitHub Flavored Markdown 활성화 (일반적인 마크다운 호환성)
});

interface Props {
  content: string;
}

const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  // 1. $$...$$ (블록 수학)으로 텍스트 분리
  const blockParts = content.split(/(\$\$[\s\S]*?\$\$)/g);

  return (
    <>
      {blockParts.map((blockPart, i) => {
        if (blockPart.startsWith('$$') && blockPart.endsWith('$$')) {
          // 블록 수학 렌더링
          const math = blockPart.slice(2, -2);
          return <BlockMath key={`block-${i}`}>{math}</BlockMath>;
        }

        // 2. $...$ (인라인 수학)으로 나머지 텍스트 분리
        const inlineParts = blockPart.split(/(\$[\s\S]*?\$)/g);
        
        return inlineParts.map((inlinePart, j) => {
          if (inlinePart.startsWith('$') && inlinePart.endsWith('$')) {
            // 인라인 수학 렌더링
            const math = inlinePart.slice(1, -1);
            return <InlineMath key={`inline-${i}-${j}`}>{math}</InlineMath>;
          }
          
          // 3. 남은 부분은 Markdown으로 렌더링
          if (inlinePart) {
            return (
              <span
                key={`text-${i}-${j}`}
                dangerouslySetInnerHTML={{ __html: marked(inlinePart) as string }}
              />
            );
          }
          return null;
        });
      })}
    </>
  );
};

export default MarkdownRenderer;