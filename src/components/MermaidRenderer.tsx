import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { normalizeMermaidCode } from '../lib/markdownUtils'; // Assuming this is still needed

interface MermaidRendererProps {
  code: string;
}

const MermaidRenderer: React.FC<MermaidRendererProps> = ({ code }) => {
  const mermaidRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mermaidRef.current) {
      setError(null); // Clear previous errors
      const processedCode = normalizeMermaidCode(code);
      mermaidRef.current.innerHTML = ''; // Clear previous diagram

      // Add a short delay to ensure DOM is ready
      setTimeout(async () => {
        try {
          const { svg } = await mermaid.render(`mermaid-diagram-${Date.now()}`, processedCode);
          mermaidRef.current.innerHTML = svg;
        } catch (e) {
          console.error('Mermaid 렌더링 실패:', e);
          setError('다이어그램 렌더링 오류');
        }
      }, 10);
    }
  }, [code]);

  if (error) {
    return <div style={{ color: 'red', textAlign: 'center' }}>{error}</div>;
  }

  return <div ref={mermaidRef} className="mermaid-diagram" />;
};

export default MermaidRenderer;