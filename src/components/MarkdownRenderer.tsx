// src/components/MarkdownRenderer.tsx

import React, { useEffect, useRef } from 'react';

import { marked } from 'marked';

import { InlineMath, BlockMath } from 'react-katex';

import mermaid from 'mermaid';

import JointJSRenderer from './JointJSRenderer';

import 'highlight.js/styles/github-dark.css';



// Mermaid.js 초기화
mermaid.initialize({
  startOnLoad: false,
  theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
  securityLevel: 'loose',
});



interface Props {
  content: string;
}



// 텍스트 한 줄(문단) 내에서 인라인 수학($...$)을 처리하는 헬퍼 함수
const renderInlineContent = (text: string, keyPrefix: string) => {
    const parts = text.split(/(\$\S[\s\S]*?\S\$)/g);
    return parts.map((part, index) => {
        if (part.startsWith('$') && part.endsWith('$')) {
            return <InlineMath key={`${keyPrefix}-${index}`}>{part.slice(1, -1)}</InlineMath>;
        }
        // 인라인 텍스트 내의 다른 마크다운(**볼드** 등)을 처리
        return <span key={`${keyPrefix}-${index}`} dangerouslySetInnerHTML={{ __html: marked.parseInline(part) as string }} />;
    });
};



const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);



  useEffect(() => {
    if (containerRef.current) {
        const mermaidElements = containerRef.current.querySelectorAll('pre.mermaid > code');
        if (mermaidElements.length > 0) {
            mermaid.run({ nodes: mermaidElements as NodeListOf<HTMLElement> });
        }
    }
  }, [content]);



  // 🚀 새로운 렌더링 로직의 핵심
  const renderBlocks = () => {
    if (!content) return null;



    // 1. 먼저 JointJS, Mermaid, 블록 수학 같은 '특수 블록'들을 기준으로 전체 노트를 나눕니다.

    const blocks = content.split(/(```(?:jointjs|mermaid)[\s\S]*?```|\$\$[\][\s\S]*?\$\$)/g);



    return blocks.map((block, i) => {

      if (!block) return null;



      // 2. 각 '특수 블록'을 렌더링합니다.

      if (block.startsWith('```jointjs')) {
        const jsonText = block.slice(10, -3).trim();
        try {
          const jointData = JSON.parse(jsonText);
          return <div className="my-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800" key={i}><JointJSRenderer data={jointData} /></div>;
        } catch (e) {
          return <pre key={i} style={{ color: 'red' }}>JointJS JSON 오류</pre>;
        }
      }



      if (block.startsWith('```mermaid')) {
        const code = block.slice(10, -3).trim();
        return (

          <div className="flex justify-center my-4" key={i}>

            <pre className="mermaid"><code>{code}</code></pre>

          </div>

        );

      }



      if (block.startsWith('$$') && block.endsWith('$$')) {

        return <BlockMath key={i}>{block.slice(2, -2)}</BlockMath>;

      }



      // 3. '특수 블록'이 아닌 나머지 텍스트 덩어리는 문단(엔터 두 번) 기준으로 다시 나눕니다.

      const paragraphs = block.trim().split(/\n\s*\n/);

      return paragraphs.map((para, pIndex) => {

        if (!para.trim()) return null;



        // 4. 각 문단을 <p> 태그로 감싸고, 그 안에서 인라인 수학($)을 처리합니다.

        return (

          <p key={`${i}-${pIndex}`}>

            {renderInlineContent(para, `${i}-${pIndex}`)}

          </p>

        );

      });

    });

  };



  return <div ref={containerRef}>{renderBlocks()}</div>;

}; 



export default MarkdownRenderer;
