// src/components/MarkdownRenderer.tsx
import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { InlineMath, BlockMath } from 'react-katex';
import mermaid from 'mermaid';
import VisualRenderer from './VisualRenderer';
import { normalizeMermaidCode } from '../lib/markdownUtils';
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

  useEffect(() => {
    const renderMermaidDiagrams = async () => {
      if (containerRef.current) {
        const mermaidElements = containerRef.current.querySelectorAll('pre.mermaid:not([data-processed])');
        if (mermaidElements.length > 0) {
          // ✅ [수정] 렌더링을 다음 이벤트 루프로 넘겨 DOM이 준비될 시간을 확보합니다.
          setTimeout(async () => {
            try {
              // 렌더링 전에 각 코드 블록의 내용을 정규화합니다.
              mermaidElements.forEach(el => {
                const codeEl = el.querySelector('code');
                if (codeEl) {
                  codeEl.innerHTML = normalizeMermaidCode(codeEl.innerHTML);
                }
              });
              await mermaid.run({ nodes: mermaidElements as NodeListOf<HTMLElement> });
              mermaidElements.forEach(el => el.setAttribute('data-processed', 'true'));
            } catch (error) {
              console.error('Mermaid 렌더링 실패:', error);
              mermaidElements.forEach(el => {
                el.innerHTML = '다이어그램 렌더링 오류';
                el.setAttribute('style', 'color: red; text-align: center;');
              });
            }
          }, 10); // 10ms 정도의 짧은 지연
        }
      }
    };
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

  const renderParts = () => {
    if (!content) return null;
    
    const blockRegex = /(```(?:mermaid|visual|chart|[\s\S]*?)```|<details[\s\S]*?<\/details>|[\s\S]+?(?=```|<details|$))/g;
    const blocks = content.match(blockRegex) || [];

    return blocks.map((block, i) => {
      const trimmedBlock = block.trim();
      
      if (trimmedBlock.startsWith('```mermaid')) {
        const rawCode = trimmedBlock.slice(10, -3).trim();
        // ✅ 3. AI가 생성한 코드를 정규화 함수에 통과시킵니다.
        const normalizedCode = normalizeMermaidCode(rawCode);

        return (
          <div 
            className="flex justify-center my-4 cursor-zoom-in" 
            key={i}
            onClick={() => setModalMermaidCode(rawCode)} // 모달에는 원본 코드를 넘겨줌
            title="클릭하여 크게 보기"
          >
            <pre className="mermaid"><code>{normalizedCode}</code></pre>
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
      
      // ✅ [수정] <details> 블록을 수동으로 파싱하고, 내부 콘텐츠를 MarkdownRenderer로 재귀 호출합니다.
      if (trimmedBlock.startsWith('<details')) {
        const summaryMatch = trimmedBlock.match(/<summary>([\s\S]*?)<\/summary>/);
        const summaryContent = summaryMatch ? summaryMatch[1] : '자세히 보기';

        const mainContentMatch = trimmedBlock.match(/<\/summary>([\s\S]*)<\/details>/);
        let mainContent = mainContentMatch ? mainContentMatch[1] : '';

        // 내부의 <div> 태그 제거 (선택적)
        mainContent = mainContent.trim().replace(/^<div>/, '').replace(/<\/div>$/, '').trim();

        return (
            <details key={i} className="prose dark:prose-invert max-w-none my-4 border rounded-lg">
                <summary className="cursor-pointer p-4 font-semibold" dangerouslySetInnerHTML={{ __html: marked.parseInline(summaryContent, { gfm: true, breaks: true }) }} />
                <div className="p-4 border-t">
                    {/* 재귀 렌더링으로 내부 콘텐츠도 완벽하게 처리 */}
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