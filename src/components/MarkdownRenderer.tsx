// src/components/MarkdownRenderer.tsx
import React, { useEffect, useRef } from 'react';
import { marked } from 'marked';
import { InlineMath, BlockMath } from 'react-katex';
import mermaid from 'mermaid';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import JointJSRenderer from './JointJSRenderer'; // 🚀 JointJS 컴포넌트 임포트
import VisualRenderer from './VisualRenderer'; // 🚀 VisualRenderer 컴포넌트 임포트

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
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (containerRef.current) {
        const mermaidElements = containerRef.current.querySelectorAll('pre.mermaid > code');
        if (mermaidElements.length > 0) {
            mermaid.run({ nodes: mermaidElements as NodeListOf<HTMLElement> });
        }
    }
  }, [content]);

  // 🚀 [수정] jointjs, visual, mermaid, katex를 모두 분리하도록 정규식 확장
  const parts = content.split(/(```(?:jointjs|visual|mermaid)[\s\S]*?```|\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);

  return (
    <span ref={containerRef}>
      {parts.map((part, i) => {
        if (!part) return null;

        // 블록 수학 (KaTeX)
        if (part.startsWith('$$') && part.endsWith('$$')) {
          return <BlockMath key={i}>{part.slice(2, -2)}</BlockMath>;
        }
        
        // 인라인 수학 (KaTeX)
        if (part.startsWith('$') && part.endsWith('$')) {
          return <InlineMath key={i}>{part.slice(1, -1)}</InlineMath>;
        }

        // Mermaid 다이어그램
        if (part.startsWith('```mermaid')) {
          const code = part.slice(10, -3).trim();
          return (
            <div className="flex justify-center my-4">
              <pre className="mermaid" key={i}>
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        // 🚀 JointJS 동적 컴포넌트
        if (part.startsWith('```jointjs')) {
          const jsonText = part.slice(10, -3).trim();
          try {
            const jointData = JSON.parse(jsonText);
            return <div className="my-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800" key={i}><JointJSRenderer data={jointData} /></div>;
          } catch (e) {
            console.error('Failed to parse JointJS JSON:', e);
            return <pre key={i} style={{ color: 'red' }}>JointJS 다이어그램 JSON 오류</pre>;
          }
        }

        // 🚀 동적 시각 컴포넌트
        if (part.startsWith('```visual')) {
          const jsonText = part.slice(10, -3).trim();
          try {
            const visualData = JSON.parse(jsonText);
            return <div className="my-4" key={i}><VisualRenderer config={visualData} /></div>;
          } catch (e) {
            console.error('Failed to parse visual JSON:', e);
            return <pre key={i} style={{ color: 'red' }}>동적 시각화 컴포넌트 JSON 오류</pre>;
          }
        }
        
        // 나머지 일반 텍스트 및 마크다운
        return (
          <span
            key={i}
            dangerouslySetInnerHTML={{ __html: marked.parseInline(part) as string }}
          />
        );
      })}
    </span>
  );}

export default MarkdownRenderer;