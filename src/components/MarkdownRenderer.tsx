// src/components/MarkdownRenderer.tsx
import React, { useEffect, useRef } from 'react';
import { marked } from 'marked';
import { InlineMath, BlockMath } from 'react-katex';
import mermaid from 'mermaid';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css'; // 다크모드에 잘 어울리는 테마

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
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
        securityLevel: 'loose',
      });
    } catch (e) {
      console.error('Mermaid 초기화 실패', e);
    }
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      // Mermaid 다이어그램 렌더링
      const mermaidElements = containerRef.current.querySelectorAll('code.language-mermaid');
      mermaidElements.forEach((element, index) => {
        const mermaidCode = element.textContent || '';
        const id = `mermaid-diagram-${Date.now()}-${index}`;
        try {
          mermaid.render(id, mermaidCode, (svgCode) => {
            element.parentElement!.innerHTML = svgCode;
          });
        } catch (error) {
          console.error('Mermaid 렌더링 오류:', error);
          const errorMessage = document.createElement('div');
          errorMessage.innerHTML = `
            <div class="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              <p class="font-bold">다이어그램 렌더링 오류</p>
              <pre class="mt-2 text-xs whitespace-pre-wrap">${(error as Error).message}</pre>
            </div>
          `;
          element.parentElement!.replaceWith(errorMessage);
        }
      });
    }
  }, [content]);

  const blockParts = content.split(/(\$\$[\s\S]*?\$\$)/g);

  return (
    <span ref={containerRef}>
      {blockParts.map((blockPart, i) => {
        if (blockPart.startsWith('$$') && blockPart.endsWith('$$')) {
          const math = blockPart.slice(2, -2);
          return <BlockMath key={`block-${i}`}>{math}</BlockMath>;
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