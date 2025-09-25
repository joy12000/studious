// src/components/MarkdownRenderer.tsx
import React, { useEffect, useRef, useState } from 'react'; // ✅ [수정] useState를 여기서 임포트합니다.
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
  // LaTeX 수식을 찾는 정규식
  const regex = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (!part) return null;
    const trimmedPart = part.trim();

    if (trimmedPart.startsWith('$$') && trimmedPart.endsWith('$$')) {
      return <BlockMath key={i}>{trimmedPart.slice(2, -2)}</BlockMath>;
    }
    if (trimmedPart.startsWith('$') && trimmedPart.endsWith('$')) {
      return <InlineMath key={i}>{trimmedPart.slice(1, -1)}</InlineMath>;
    }

    // 일반 텍스트 조각은 `parseInline`을 사용해 <p> 태그 없이 렌더링 + breaks 옵션 추가
    return <span key={i} dangerouslySetInnerHTML={{ __html: marked.parseInline(part, { gfm: true, breaks: true }) as string }} />;
  });
};


const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [modalMermaidCode, setModalMermaidCode] = useState<string | null>(null);
  const modalMermaidRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        const mermaidElements = containerRef.current.querySelectorAll('pre.mermaid > code');
        if (mermaidElements.length > 0) {
            mermaid.run({ nodes: mermaidElements as NodeListOf<HTMLElement> });
        }
      } catch (error) {
        console.error('Failed to render Mermaid diagram:', error);
      }
    }
  }, [content]);
  
  // 모달이 열리고 내용이 바뀌면, 모달 안의 Mermaid를 렌더링하는 useEffect
  useEffect(() => {
    if (modalMermaidCode && modalMermaidRef.current) {
      modalMermaidRef.current.innerHTML = ''; // 이전 다이어그램 초기화
      const pre = document.createElement('pre');
      pre.className = 'mermaid';
      pre.innerHTML = modalMermaidCode;
      modalMermaidRef.current.appendChild(pre);
      try {
        mermaid.run({ nodes: [pre] });
      } catch (e) {
        console.error('Failed to render mermaid in modal', e);
        modalMermaidRef.current.innerText = '다이어그램 렌더링 오류';
      }
    }
  }, [modalMermaidCode]);

  const renderParts = () => {
    if (!content) return null;

    // 복합적인 마크다운 블록을 먼저 분리 (코드블록, 그 외 텍스트)
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
       // 일반 코드 블록 및 기타 마크다운 처리
      if (trimmedBlock.startsWith('```')) {
         return <div key={i} dangerouslySetInnerHTML={{ __html: marked(block, { gfm: true, breaks: true }) as string }} />;
      }
      
      // 일반 텍스트 덩어리는 문단(\n\n)별로 나누어 처리
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