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

const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Mermaid 렌더링
    if (containerRef.current) {
      const mermaidElements = containerRef.current.querySelectorAll('pre.mermaid > code');
      if (mermaidElements.length > 0) {
        try {
          mermaid.run({ nodes: mermaidElements as NodeListOf<HTMLElement> });
        } catch (e) {
          console.error('Mermaid rendering error:', e);
        }
      }
    }
  }, [content]);

  const renderContent = () => {
    if (!content) return null;

    const placeholders: React.ReactNode[] = [];
    const regex = /(```(?:jointjs|mermaid|visual)[\s\S]*?```|\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;

    // 1단계: 특수 부품(컴포넌트)을 찾아서 임시 배열에 저장하고, 자리 표시로 남깁니다.
    const processedText = content.replace(regex, (match) => {
      if (match.startsWith('```jointjs')) {
        const jsonText = match.slice(10, -3).trim();
        try {
          const jointData = JSON.parse(jsonText);
          placeholders.push(<div className="my-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800"><JointJSRenderer data={jointData} /></div>);
        } catch (e) {
          placeholders.push(<pre style={{ color: 'red' }}>JointJS 렌더링 오류</pre>);
        }
      } else if (match.startsWith('```mermaid')) {
        const code = match.slice(10, -3).trim();
        placeholders.push(<div className="flex justify-center my-4"><pre className="mermaid"><code>{code}</code></pre></div>);
      } else if (match.startsWith('```visual')) {
        const jsonText = match.slice(10, -3).trim();
        try {
          const visualData = JSON.parse(jsonText);
          placeholders.push(<div className="my-4"><VisualRenderer config={visualData} /></div>);
        } catch(e) {
          placeholders.push(<pre style={{ color: 'red' }}>Visual Component 렌더링 오류</pre>);
        }
      } else if (match.startsWith('$$')) {
        placeholders.push(<BlockMath>{match.slice(2, -2)}</BlockMath>);
      } else if (match.startsWith('$')) {
        placeholders.push(<InlineMath>{match.slice(1, -1)}</InlineMath>);
      }
      
      return ``;
    });

    // 2단계: 특수 부품이 제거된 순수 마크다운 텍스트를 HTML로 변환합니다.
    const html = marked(processedText, { breaks: true, gfm: true }) as string;
    const parts = html.split(//g);

    // 3단계: HTML 조각과 특수 부품(컴포넌트)을 다시 합칩니다.
    return parts.map((part, index) => {
      if (index % 2 === 0) {
        return <span key={index} dangerouslySetInnerHTML={{ __html: part }} />;
      } else {
        const placeholderIndex = parseInt(part, 10);
        return <React.Fragment key={index}>{placeholders[placeholderIndex]}</React.Fragment>;
      }
    });
  };

  return <div ref={containerRef}>{renderContent()}</div>;
};

export default MarkdownRenderer;