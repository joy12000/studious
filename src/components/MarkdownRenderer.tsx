// src/components/MarkdownRenderer.tsx
import React, { useEffect, useRef } from 'react';
import { marked } from 'marked';
import { InlineMath, BlockMath } from 'react-katex';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

// Marked.js에 highlight.js 연동 설정
marked.setOptions({
  highlight: function(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  },
});

marked.use({
  breaks: true,
  gfm: true,
});

interface Props {
  content: string;
}

const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const renderMermaidDiagrams = async () => {
      if (containerRef.current) {
        const mermaidElements = containerRef.current.querySelectorAll('code.language-mermaid');
        if (mermaidElements.length > 0) {
          try {
            const mermaid = (await import('mermaid')).default;
            mermaid.initialize({
              startOnLoad: false,
              theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
              securityLevel: 'loose',
            });

            // mermaid.run()은 Promise를 반환하므로 .catch()로 오류 처리
            mermaid.run({ nodes: mermaidElements as NodeListOf<HTMLElement> })
              .catch(error => {
                console.error('Mermaid 렌더링 오류:', error);
                if (containerRef.current) {
                  containerRef.current.innerHTML = `
                    <div class="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                      <p class="font-bold">다이어그램 렌더링 오류</p>
                      <pre class="mt-2 text-xs whitespace-pre-wrap">${(error as Error).message}</pre>
                    </div>
                  `;
                }
              });
          } catch (e) {
            console.error('Mermaid 라이브러리 로드 실패:', e);
          }
        }
      }
    };

    renderMermaidDiagrams();
  }, [content]);

  const blockParts = content.split(/(```mermaid[\s\S]*?```|\$\$[\s\S]*?\$\$)/g);

  return (
    <span ref={containerRef}>
      {blockParts.map((blockPart, i) => {
        if (blockPart.startsWith('$$') && blockPart.endsWith('$$')) {
          const math = blockPart.slice(2, -2);
          return <BlockMath key={`block-${i}`}>{math}</BlockMath>;
        }

        // 🚀 [추가] Mermaid 코드 블록 처리 로직
        if (blockPart.startsWith('```mermaid')) {
          const code = blockPart.slice(10, -3).trim();
          return (
            <pre className="mermaid" key={`mermaid-${i}`}>
              <code className="language-mermaid">{code}</code>
            </pre>
          );
        }

        const inlineParts = blockPart.split(/(\$[\s\S]*?\$)/g);
        
        return inlineParts.map((inlinePart, j) => {
          if (inlinePart.startsWith('$') && inlinePart.endsWith('$')) {
            const math = inlinePart.slice(1, -1);
            return <InlineMath key={`inline-${i}-${j}`}>{math}</InlineMath>;
          }
          
          if (inlinePart) {
            return (
              <span
                key={`text-${i}-${j}`}
                dangerouslySetInnerHTML={{ __html: marked.parseInline(inlinePart) as string }}
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