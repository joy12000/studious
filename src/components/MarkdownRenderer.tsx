// src/components/MarkdownRenderer.tsx
import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { InlineMath, BlockMath } from 'react-katex';
import mermaid from 'mermaid';
import VisualRenderer from './VisualRenderer';
import { normalizeMermaidCode } from '../lib/markdownUtils';
import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';

// Mermaid 초기화 코드 ...

interface Props {
  content: string;
}

// renderInlineContent 함수 ...

const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [modalMermaidCode, setModalMermaidCode] = useState<string | null>(null);
  const modalMermaidRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderMermaidDiagrams = async () => {
      if (containerRef.current) {
        const mermaidElements = Array.from(containerRef.current.querySelectorAll('pre.mermaid:not([data-processed])'));
        if (mermaidElements.length > 0) {
          try {
            // 렌더링 전에 각 코드 블록의 내용을 정규화합니다.
            mermaidElements.forEach(el => {
              const codeEl = el.querySelector('code');
              if (codeEl) {
                const rawCode = codeEl.textContent || '';
                codeEl.textContent = normalizeMermaidCode(rawCode);
              }
            });

            await mermaid.run({ nodes: mermaidElements as HTMLElement[] });
            mermaidElements.forEach(el => el.setAttribute('data-processed', 'true'));
          } catch (error) {
            console.error('Mermaid 렌더링 실패:', error);
            mermaidElements.forEach(el => {
              el.innerHTML = '다이어그램 렌더링 오류. 코드를 확인해주세요.';
              el.setAttribute('style', 'color: red; text-align: center; padding: 1rem;');
            });
          }
        }
      }
    };
    // 불필요한 setTimeout 제거
    renderMermaidDiagrams();
  }, [content]);

  useEffect(() => {
    const renderModalMermaid = async () => {
      if (modalMermaidCode && modalMermaidRef.current) {
        modalMermaidRef.current.innerHTML = '';
        const pre = document.createElement('pre');
        pre.className = 'mermaid';
        pre.innerHTML = normalizeMermaidCode(modalMermaidCode);
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

  // renderParts 함수 및 return JSX는 이전과 동일하게 유지

  const renderParts = () => {
    if (!content) return null;
    
    const blockRegex = /(```(?:mermaid|visual|chart|[\s\S]*?)```|<details[\s\S]*?<\/details>|[\s\S]+?(?=```|<details|$))/g;
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
      
      if (trimmedBlock.startsWith('<details')) {
        const summaryMatch = trimmedBlock.match(/<summary>([\s\S]*?)<\/summary>/);
        const summaryContent = summaryMatch ? summaryMatch[1] : '자세히 보기';

        const mainContentMatch = trimmedBlock.match(/<\/summary>([\s\S]*)<\/details>/);
        let mainContent = mainContentMatch ? mainContentMatch[1] : '';

        mainContent = mainContent.trim().replace(/^<div>/, '').replace(/<\/div>$/, '').trim();

        return (
            <details key={i} className="prose dark:prose-invert max-w-none my-4 border rounded-lg">
                <summary className="cursor-pointer p-4 font-semibold" dangerouslySetInnerHTML={{ __html: marked.parseInline(summaryContent, { gfm: true, breaks: true }) }} />
                <div className="p-4 border-t">
                    <MarkdownRenderer content={mainContent} />
                </div>
            </details>
        );
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