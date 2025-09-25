// src/components/MarkdownRenderer.tsx
import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { InlineMath, BlockMath } from 'react-katex';
import mermaid from 'mermaid';
import VisualRenderer from './VisualRenderer';
import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';

// Mermaid.js 초기화
mermaid.initialize({
  startOnLoad: false,
  theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
  securityLevel: 'loose',
});

interface Props {
  content: string;
}

// 문단 내부의 인라인 요소만 렌더링하는 함수
const renderInlineContent = (text: string) => {
  if (!text) return null;
  const regex = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (!part) return null;
    const trimmedPart = part.trim();

    if (trimmedPart.startsWith('$$') && trimmedPart.endsWith('$$')) {
      return <BlockMath key={i}>{part.slice(2, -2)}</BlockMath>;
    }
    if (trimmedPart.startsWith('$') && trimmedPart.endsWith('$')) {
      return <InlineMath key={i}>{part.slice(1, -1)}</InlineMath>;
    }

    return <span key={i} dangerouslySetInnerHTML={{ __html: marked.parseInline(part, { gfm: true, breaks: true }) as string }} />;
  });
};


const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [modalMermaidCode, setModalMermaidCode] = useState<string | null>(null);
  const modalMermaidRef = useRef<HTMLDivElement>(null);

  // ✅ [수정] Mermaid 렌더링 useEffect를 async/await 및 try/catch로 감싸 에러를 처리합니다.
  useEffect(() => {
    const renderMermaidDiagrams = async () => {
      if (containerRef.current) {
        // 렌더링되지 않은 mermaid 블록을 찾습니다.
        const mermaidElements = containerRef.current.querySelectorAll('pre.mermaid:not([data-processed])');
        if (mermaidElements.length > 0) {
          try {
            // mermaid.run()은 Promise를 반환하므로 await으로 기다립니다.
            await mermaid.run({ nodes: mermaidElements as NodeListOf<HTMLElement> });
          } catch (error) {
            console.error('Mermaid 렌더링 실패:', error);
            // 오류가 발생한 다이어그램에 에러 메시지를 표시할 수도 있습니다.
            mermaidElements.forEach(el => {
              el.innerHTML = '다이어그램 렌더링 오류';
              el.setAttribute('style', 'color: red; text-align: center;');
            });
          }
        }
      }
    };
    
    renderMermaidDiagrams();
  }, [content]);
  
  // 모달이 열리고 내용이 바뀌면, 모달 안의 Mermaid를 렌더링하는 useEffect
  useEffect(() => {
    const renderModalMermaid = async () => {
      if (modalMermaidCode && modalMermaidRef.current) {
        modalMermaidRef.current.innerHTML = ''; // 이전 다이어그램 초기화
        const pre = document.createElement('pre');
        pre.className = 'mermaid';
        pre.innerHTML = modalMermaidCode;
        modalMermaidRef.current.appendChild(pre);
        try {
          await mermaid.run({ nodes: [pre] });
        } catch (e) {
          console.error('모달에서 Mermaid 렌더링 실패:', e);
          modalMermaidRef.current.innerText = '다이어그램 렌더링 오류';
        }
      }
    };
    renderModalMermaid();
  }, [modalMermaidCode]);

  const renderParts = () => {
    if (!content) return null;

    const blockRegex = /(```(?:mermaid|visual|chart|[\s\S]*?)```|[\s\S]+?(?=```|$))/g;
    const blocks = content.match(blockRegex) || [];

    return blocks.map((block, i) => {
      const trimmedBlock = block.trim();
      
      if (trimmedBlock.startsWith('```mermaid')) {
        const code = trimmedBlock.slice(10, -3).trim();
        return (
          <div 
            className="flex justify-center my-4 cursor-zoom-in" 
            key={i}
            onClick={() => setModalMermaidCode(code)}
            title="클릭하여 크게 보기"
          >
            {/* pre 태그는 초기에 코드만 담고, useEffect가 렌더링을 처리합니다. */}
            <pre className="mermaid"><code>{code}</code></pre>
          </div>
        );
      }
      if (trimmedBlock.startsWith('```visual')) {
        const jsonText = trimmedBlock.slice(10, -3).trim();
        try {
          const visualData = JSON.parse(jsonText);
          return <div className="my-4" key={i}><VisualRenderer config={visualData} /></div>;
        } catch(e) {
          return <pre key={i} style={{ color: 'red' }}>Visual JSON Error</pre>;
        }
      }
      if (trimmedBlock.startsWith('```')) {
         return <div key={i} dangerouslySetInnerHTML={{ __html: marked(block, { gfm: true, breaks: true }) as string }} />;
      }
      
      if (trimmedBlock) {
        return trimmedBlock.split(/\n\n+/).map((paragraph, j) => (
          <p key={`${i}-${j}`}>{renderInlineContent(paragraph)}</p>
        ));
      }

      return null;
    });
  }; 

  return (
    <div ref={containerRef}>
      {renderParts()}

      {modalMermaidCode && (
        <div className="mermaid-modal-overlay" onClick={() => setModalMermaidCode(null)}>
          <div className="mermaid-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="mermaid-modal-close" onClick={() => setModalMermaidCode(null)}>×</button>
            <div ref={modalMermaidRef} className="w-full h-full flex items-center justify-center"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarkdownRenderer;