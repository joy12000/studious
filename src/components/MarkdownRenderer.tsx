// src/components/MarkdownRenderer.tsx
import React, { useEffect, useRef } from 'react';
import { marked } from 'marked';
import { InlineMath, BlockMath } from 'react-katex';
import mermaid from 'mermaid';
import JointJSRenderer from './JointJSRenderer'; // JointJS 렌더러 임포트
import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css'; // KaTeX CSS 임포트

// Mermaid.js 초기화
mermaid.initialize({
  startOnLoad: false,
  theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
  securityLevel: 'loose',
});

interface Props {
  content: string;
}

const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Mermaid 렌더링을 위한 useEffect는 그대로 유지
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

  const renderParts = () => {
    if (!content) return null;

    // 🚀 [핵심] 모든 특수 블록과 인라인 수식을 한번에 식별하는 통합 정규식
    const regex = /(```(?:jointjs|mermaid|visual|chart)[\s\S]*?```|\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;
    const parts = content.split(regex);

    return parts.map((part, i) => {
      if (!part) return null;

      // 블록 KaTeX ( $$...$$ )
      if (part.startsWith('$$') && part.endsWith('$$')) {
        return <BlockMath key={i}>{part.slice(2, -2)}</BlockMath>;
      }

      // 인라인 KaTeX ( $...$ )
      if (part.startsWith('$') && part.endsWith('$')) {
        return <InlineMath key={i}>{part.slice(1, -1)}</InlineMath>;
      }

      // Mermaid 다이어그램
      if (part.startsWith('```mermaid')) {
        const code = part.slice(10, -3).trim();
        return (
          <div className="flex justify-center my-4" key={i}>
            <pre className="mermaid"><code>{code}</code></pre>
          </div>
        );
      }

      // JointJS 다이어그램 (회로도, 시각화 등)
      if (part.startsWith('```jointjs')) {
        const jsonText = part.slice(10, -3).trim();
        try {
          const jointData = JSON.parse(jsonText);
          return <div className="my-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800" key={i}><JointJSRenderer data={jointData} /></div>;
        } catch (e) {
          console.error('Failed to parse JointJS JSON:', e);
          return <pre key={i} style={{ color: 'red' }}>JointJS 다이어그램 렌더링 오류</pre>;
        }
      }
      
      // 🚀 [가장 중요한 수정]
      // 위에서 걸러지지 않은 나머지 모든 텍스트는 일반 마크다운으로 취급
      // marked() 함수가 문단, 목록, 강조 등 모든 것을 올바르게 처리
      return <span key={i} dangerouslySetInnerHTML={{ __html: marked(part) as string }} />;
    });
  }; 

  // 렌더링 컨테이너는 div를 사용해야 문단(<p>) 등이 올바르게 포함됩니다.
  return <div ref={containerRef}>{renderParts()}</div>;
};

export default MarkdownRenderer;
