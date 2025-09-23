import React, { useEffect, useRef } from 'react';
import { marked } from 'marked';
import { InlineMath, BlockMath } from 'react-katex';
import mermaid from 'mermaid';

marked.use({
  breaks: true,
  gfm: true,
});

// --- 📊 [기능 추가] Mermaid 초기화 ---
mermaid.initialize({
  startOnLoad: false,
  theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
  securityLevel: 'loose',
});

interface Props {
  content: string;
}

const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  // --- 📊 [기능 추가] 렌더링 후 Mermaid 다이어그램 변환 ---
  useEffect(() => {
    if (containerRef.current) {
        const mermaidElements = containerRef.current.querySelectorAll('.language-mermaid');
        if (mermaidElements.length > 0) {
            mermaid.run({ nodes: mermaidElements as NodeListOf<HTMLElement> });
        }
    }
  }, [content]);

  // KaTeX와 마크다운을 함께 처리하는 로직은 그대로 유지합니다.
  const blockParts = content.split(/(\$\$[\s\S]*?\$\$)/g);

  return (
    <span ref={containerRef}>
      {blockParts.map((blockPart, i) => {
        if (blockPart.startsWith('$') && blockPart.endsWith('$')) {
          const math = blockPart.slice(2, -2);
          return <BlockMath key={`block-${i}`}>{math}</BlockMath>;
        }

        const inlineParts = blockPart.split(/(\$[\s\S]*?\$)/g);
        
        return inlineParts.map((inlinePart, j) => {
          if (inlinePart.startsWith(') && inlinePart.endsWith(')) {
            const math = inlinePart.slice(1, -1);
            return <InlineMath key={`inline-${i}-${j}`}>{math}</InlineMath>;
          }
          
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
    </span>
  );
};

export default MarkdownRenderer;