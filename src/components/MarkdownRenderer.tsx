// src/components/MarkdownRenderer.tsx
import React, { useEffect, useRef } from 'react';
import { marked } from 'marked';
import { InlineMath, BlockMath } from 'react-katex';
import mermaid from 'mermaid';
import JointJSRenderer from './JointJSRenderer';
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

const renderInlineContent = (text: string) => {
  if (!text) return null;
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

    // ✅ [수정] gfm과 breaks 옵션을 추가하여 문단 내 줄바꿈을 <br>로 변환
    return <span key={i} dangerouslySetInnerHTML={{ __html: marked.parseInline(part, { gfm: true, breaks: true }) as string }} />;
  });
};


const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // ✅ [2단계] 모달의 상태를 관리할 state를 추가합니다. (Mermaid 코드 저장)
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
  
  // ✅ [3단계] 모달이 열리고 내용이 바뀌면, 모달 안의 Mermaid를 렌더링하는 useEffect 추가
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
    
    const blockRegex = /(```(?:mermaid|visual|chart|[\s\S]*?)```|[\s\S]+?(?=```|$))/g;
    const blocks = content.match(blockRegex) || [];

    return blocks.map((block, i) => {
      const trimmedBlock = block.trim();
      
      if (trimmedBlock.startsWith('```mermaid')) {
        const code = trimmedBlock.slice(10, -3).trim();
        return (
          // ✅ [4단계] Mermaid 래퍼를 클릭 가능한 div로 변경하고 onClick 이벤트 핸들러 추가
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
         // ✅ [수정] 일반 코드 블록에도 gfm과 breaks 옵션을 추가하여 일관성 유지
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
    // ✅ [5단계] 컴포넌트의 최종 리턴값에 모달 JSX 추가
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