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

    const regex = /(```(?:jointjs|mermaid|visual|chart)[\s\S]*?```|\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;
    const parts = content.split(regex);

    return parts.map((part, i) => {
      if (!part) return null;

      const trimmedPart = part.trim();

      if (trimmedPart.startsWith('$$') && trimmedPart.endsWith('$$')) {
        return <BlockMath key={i}>{trimmedPart.slice(2, -2)}</BlockMath>;
      }

      if (trimmedPart.startsWith('$') && trimmedPart.endsWith('$')) {
        return <InlineMath key={i}>{trimmedPart.slice(1, -1)}</InlineMath>;
      }

      if (trimmedPart.startsWith('```mermaid')) {
        const code = trimmedPart.slice(10, -3).trim();
        return (
          <div className="flex justify-center my-4" key={i}>
            <pre className="mermaid"><code>{code}</code></pre>
          </div>
        );
      }

      if (trimmedPart.startsWith('```jointjs')) {
        const jsonText = trimmedPart.slice(10, -3).trim();
        try {
          const jointData = JSON.parse(jsonText);
          return <div className="my-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800" key={i}><JointJSRenderer data={jointData} /></div>;
        } catch (e) {
          return <pre key={i} style={{ color: 'red' }}>JointJS JSON Error</pre>;
        }
      }

      if (trimmedPart.startsWith('```visual')) {
        const jsonText = trimmedPart.slice(10, -3).trim();
        try {
          const visualData = JSON.parse(jsonText);
          return <div className="my-4" key={i}><VisualRenderer config={visualData} /></div>;
        } catch(e) {
          return <pre key={i} style={{ color: 'red' }}>Visual JSON Error</pre>;
        }
      }
      
      return <span key={i} dangerouslySetInnerHTML={{ __html: marked(part) as string }} />;
    });
  }; 

  return <div ref={containerRef}>{renderParts()}</div>;
};

export default MarkdownRenderer;