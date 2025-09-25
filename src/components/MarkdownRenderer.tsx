import React, { useCallback, useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { InlineMath, BlockMath } from 'react-katex';
import mermaid from 'mermaid';
import VisualRenderer from './VisualRenderer';
import MermaidRenderer from './MermaidRenderer'; // ✅ 1. 새로 만든 MermaidRenderer를 임포트
import { normalizeMermaidCode } from '../lib/markdownUtils';
import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';

interface Props {
  content: string;
}

const MarkdownRenderer: React.FC<Props> = ({ content }) => {\n  const containerRef = useRef<HTMLDivElement>(null);\n  const [modalMermaidCode, setModalMermaidCode] = useState<string | null>(null);\n  const modalMermaidRef = useRef<HTMLDivElement>(null);\n\n  // 문단 내부의 인라인 요소만 렌더링하는 함수\n  const renderInlineContent = useCallback((text: string) => {\n    if (!text) return null;\n    const regex = /(\\$\\$[\\s\\S]*?\\$\\$|\\$[\\s\\S]*?\$)/g;\n    const parts = text.split(regex);\n\n    return parts.map((part, i) => {\n      if (!part) return null;\n      const trimmedPart = part.trim();\n\n      if (trimmedPart.startsWith(\'$$\') && trimmedPart.endsWith(\'$$\')) {\n        return <BlockMath key={i}>{part.slice(2, -2)}</BlockMath>;\n      } \n      if (trimmedPart.startsWith(\'$\') && trimmedPart.endsWith(\'$\')) {\n        return <InlineMath key={i}>{part.slice(1, -1)}</InlineMath>;\n      }\n\n      return <span key={i} dangerouslySetInnerHTML={{ __html: marked.parseInline(part, { gfm: true, breaks: true }) as string }} />;\n    });\n  }, []); // No dependencies, as it only uses external imports
  // ❌ 복잡했던 Mermaid 렌더링 useEffect를 모두 삭제합니다.

  // 모달 렌더링을 위한 useEffect는 유지합니다.
  useEffect(() => {
    const renderModalMermaid = async () => {
      if (modalMermaidCode && modalMermaidRef.current) {
        modalMermaidRef.current.innerHTML = '';
        const pre = document.createElement('pre');
        pre.className = 'mermaid';
        pre.innerHTML = normalizeMermaidCode(modalMermaidCode);
        modalMermaidRef.current.appendChild(pre);
        try {
          // mermaid.run()은 Vercel 빌드 환경에서 문제를 일으킬 수 있으므로
          // mermaid.render()를 사용하는 것이 더 안정적일 수 있습니다.
          // 여기서는 기존 방식을 유지하되, 문제가 지속되면 MermaidRenderer와 동일한 방식으로 변경을 고려해야 합니다.
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
        const code = trimmedBlock.slice(10, -3).trim();
        return (
          // ✅ 2. <pre> 태그 대신 <MermaidRenderer> 컴포넌트를 사용합니다.
          <div 
            className="flex justify-center my-4 cursor-zoom-in" 
            key={i}
            onClick={() => setModalMermaidCode(code)}
            title="클릭하여 크게 보기"
          >
            <MermaidRenderer code={code} />
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