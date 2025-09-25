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

// ✅ [수정] 텍스트 한 줄(문단 내부)의 인라인 요소만 렌더링하는 함수
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

    // 일반 텍스트 조각은 `parseInline`을 사용해 <p> 태그 없이 렌더링
    return <span key={i} dangerouslySetInnerHTML={{ __html: marked.parseInline(part) as string }} />;
  });
};


const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const renderParts = () => {
    if (!content) return null;

    const blockRegex = /(```(?:jointjs|mermaid|visual|chart|[\s\S]*?)```|[\s\S]+?(?=```|$))/g;
    const blocks = content.match(blockRegex) || [];

    return blocks.map((block, i) => {
      const trimmedBlock = block.trim();
      
      if (trimmedBlock.startsWith('```mermaid')) {
        const code = trimmedBlock.slice(10, -3).trim();
        const id = `mermaid-svg-${i}`;
        try {
          const svg = mermaid.render(id, code);
          return (
            <div 
              className="flex justify-center my-4" 
              key={id} 
              dangerouslySetInnerHTML={{ __html: svg }} 
            />
          );
        } catch (e) {
          console.error("Mermaid rendering failed:", e);
          return <pre key={id} style={{ color: 'red' }}>Mermaid Diagram Error</pre>;
        }
      }
      if (trimmedBlock.startsWith('```jointjs')) {
        const jsonText = trimmedBlock.slice(10, -3).trim();
        try {
          const jointData = JSON.parse(jsonText);
          // ✅ [수정] "jointjs-container" 클래스를 추가합니다.
          return (
            <div className="jointjs-container my-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800" key={i}>
              <JointJSRenderer data={jointData} />
            </div>
          );
        } catch (e) {
          return <pre key={i} style={{ color: 'red' }}>JointJS JSON Error</pre>;
        }
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
         return <div key={i} dangerouslySetInnerHTML={{ __html: marked(block) as string }} />;
      }
      
      // ✅ [수정] 일반 텍스트 덩어리는 문단(\n\n)별로 나누어 처리
      return trimmedBlock.split(/\n\n+/).map((paragraph, j) => (
        <p key={`${i}-${j}`}>{renderInlineContent(paragraph)}</p>
      ));
    });
  }; 

  return <div ref={containerRef}>{renderParts()}</div>;
};

export default MarkdownRenderer;