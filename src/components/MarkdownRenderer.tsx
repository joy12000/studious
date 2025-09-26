// src/components/MarkdownRenderer.tsx
import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { InlineMath, BlockMath } from 'react-katex';
import mermaid from 'mermaid';

import VisualRenderer from './VisualRenderer';
import { normalizeMermaidCode } from '../lib/markdownUtils';
import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';

interface Props {
  content: string;
}

/** 문단 내부 인라인(수식/텍스트) 렌더 */
const renderInlineContent = (text: string) => {
  if (!text) return null;
  const regex = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (!part) return null;
    const trimmedPart = part.trim();

    if (trimmedPart.startsWith('$$') && trimmedPart.endsWith('$$')) {
      return <BlockMath key={i}>{part.slice(2, -2)}</BlockMath>;
    }
    if (trimmedPart.startsWith('$') && trimmedPart.endsWith('$')) {
      return <InlineMath key={i}>{part.slice(1, -1)}</InlineMath>;
    }

    return (
      <span
        key={i}
        dangerouslySetInnerHTML={{
          __html: marked.parseInline(part, { gfm: true, breaks: true }) as string,
        }}
      />
    );
  });
};

/** ✅ 최후 안전장치: 헤더가 없으면 flowchart로 강제 보충 */
const ensureDiagramHeader = (code: string): string => {
  const src = code.trim();
  // 이미 다이어그램 헤더가 있으면 그대로
  const HEADER_RE = /^(graph|flowchart|sequenceDiagram|gantt|pie|erDiagram|journey|classDiagram|stateDiagram(?:-v2)?|gitGraph|mindmap|timeline|quadrantChart|sankey|requirementDiagram|xychart-beta)\b/i;
  if (HEADER_RE.test(src)) return code;

  // flowchart로 “보이는” 시그니처면 graph 헤더를 보충
  const looksFlow =
    /(^|\n)\s*subgraph\b/i.test(src) ||
    /(^|\n)\s*[A-Za-z_][\w-]*\s*(\[\[?|\(\(?|\{\{?|\{>)/.test(src) || // ID[...], ID(...), ID{{...}}
    /(-->|-{2,3}|-\.->|<-->)/.test(src) || // -->, ---, -.->, <-->
    /(^|\n)\s*(style|linkStyle)\b/i.test(src);

  return looksFlow ? `graph TD\n${code}` : code;
};

const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [modalMermaidCode, setModalMermaidCode] = useState<string | null>(null);
  const modalMermaidRef = useRef<HTMLDivElement>(null);

  /** ✅ Mermaid 전역 초기화: 한 번만 실행 */
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      flowchart: { htmlLabels: false }, // 라벨 줄바꿈은 \n(리터럴) 처리
      securityLevel: 'loose',
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
    });
  }, []);

  /** 파싱 사전검증: 어디서 깨지는지 바로 확인 */
  const tryParseMermaid = (code: string): string | null => {
    try {
      mermaid.parse(code);
      return null;
    } catch (e: any) {
      return e?.str || e?.message || 'Unknown mermaid parse error';
    }
  };

  /** 본문 내 mermaid 코드블록 렌더 */
  useEffect(() => {
    if (!containerRef.current) return;

    const mermaidElements = containerRef.current.querySelectorAll<HTMLElement>(
      'pre.mermaid:not([data-processed])'
    );
    if (mermaidElements.length === 0) return;

    // DOM 반영 직후 실행
    requestAnimationFrame(async () => {
      const nodes: HTMLElement[] = [];

      mermaidElements.forEach((el) => {
        // 원문 코드 문자열
        const raw = (el.textContent || '').trim();

        // 1) 후보정(유틸)
        let fixed = normalizeMermaidCode(raw);
        // 2) 최후 안전장치: 헤더 보강 (normalize가 못 붙였을 경우 대비)
        fixed = ensureDiagramHeader(fixed);

        // ✅ 순수 텍스트로 주입 (HTML 섞임 방지)
        el.textContent = fixed;

        // 빠른 파서 검증
        const err = tryParseMermaid(fixed);
        if (err) {
          el.innerHTML = `<div style="color:red;text-align:center;white-space:pre-wrap;">다이어그램 파싱 오류:\n${err}</div>`;
          el.setAttribute('data-processed', 'true');
        } else {
          nodes.push(el);
        }
      });

      if (nodes.length > 0) {
        try {
          await mermaid.run({ nodes });
        } catch (error) {
          console.error('Mermaid 렌더링 실패:', error);
          nodes.forEach((el) => {
            el.innerHTML = '다이어그램 렌더링 오류';
          });
        } finally {
          nodes.forEach((n) => n.setAttribute('data-processed', 'true'));
        }
      }
    });
  }, [content]);

  /** 모달 내 렌더 */
  useEffect(() => {
    const renderModalMermaid = async () => {
      if (!modalMermaidCode || !modalMermaidRef.current) return;

      modalMermaidRef.current.innerHTML = '';
      const pre = document.createElement('pre');
      pre.className = 'mermaid';

      // 1) 후보정
      let fixed = normalizeMermaidCode(modalMermaidCode);
      // 2) 헤더 보강
      fixed = ensureDiagramHeader(fixed);

      // ✅ 모달도 텍스트로 주입
      pre.textContent = fixed;

      const err = tryParseMermaid(fixed);
      if (err) {
        modalMermaidRef.current.innerHTML =
          `<div style="color:red;text-align:center;white-space:pre-wrap;">다이어그램 파싱 오류:\n${err}</div>`;
        return;
      }

      modalMermaidRef.current.appendChild(pre);
      try {
        await mermaid.run({ nodes: [pre] });
      } catch (e) {
        console.error('모달에서 Mermaid 렌더링 실패:', e);
        modalMermaidRef.current.innerText = '다이어그램 렌더링 오류';
      }
    };

    renderModalMermaid();
  }, [modalMermaidCode]);

  /** 마크다운을 “블록” 단위로 분리 렌더 */
  const renderParts = () => {
    if (!content) return null;

    // 코드블록/디테일/일반 텍스트 분리
    const blockRegex =
      /(```(?:mermaid|visual|chart|[\s\S]*?)```|<details[\s\S]*?<\/details>|[\s\S]+?(?=```|<details|$))/g;
    const blocks = content.match(blockRegex) || [];

    return blocks.map((block, i) => {
      const trimmedBlock = block.trim();

      if (trimmedBlock.startsWith('```mermaid')) {
        // 첫 줄(펜스+언어) 분리 후 본문만 추출
        const firstNL = trimmedBlock.indexOf('\n');
        const code = trimmedBlock.slice(firstNL + 1, -3).trim();

        return (
          <div
            className="flex justify-center my-4 cursor-zoom-in"
            key={i}
            onClick={() => setModalMermaidCode(code)}
            title="클릭하여 크게 보기"
          >
            {/* 원본 코드는 여기서 그대로 넣고, useEffect에서 normalize + header 보강 + render */}
            <pre className="mermaid">{code}</pre>
          </div>
        );
      }

      if (trimmedBlock.startsWith('```visual')) {
        const firstNL = trimmedBlock.indexOf('\n');
        const jsonText = trimmedBlock.slice(firstNL + 1, -3).trim();
        try {
          const visualData = JSON.parse(jsonText);
          return (
            <div className="my-4" key={i}>
              <VisualRenderer config={visualData} />
            </div>
          );
        } catch (e) {
          return (
            <pre key={i} style={{ color: 'red' }}>
              Visual JSON Error
            </pre>
          );
        }
      }

      if (trimmedBlock.startsWith('```')) {
        // 일반 코드블록은 marked로 처리
        const html = marked.parse(trimmedBlock, { gfm: true, breaks: true }) as string;
        return <div key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      }

      if (trimmedBlock.startsWith('<details')) {
        const summaryMatch = trimmedBlock.match(/<summary>([\s\S]*?)<\/summary>/);
        const summaryContent = summaryMatch ? summaryMatch[1] : '자세히 보기';
        const mainContentMatch = trimmedBlock.match(/<\/summary>([\s\S]*)<\/details>/);
        let mainContent = mainContentMatch ? mainContentMatch[1] : '';
        mainContent = mainContent.trim().replace(/^<div>/, '').replace(/<\/div>$/, '').trim();

        return (
          <details className="prose dark:prose-invert max-w-none my-4 border rounded-lg" key={i}>
            <summary
              className="cursor-pointer p-4 font-semibold"
              dangerouslySetInnerHTML={{
                __html: marked.parseInline(summaryContent, { gfm: true, breaks: true }),
              }}
            />
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
            <button className="mermaid-modal-close" onClick={() => setModalMermaidCode(null)}>
              ×
            </button>
            <div ref={modalMermaidRef} className="w-full h-full flex items-center justify-center" />
          </div>
        </div>
      )}
    </div>
  );
};

export default MarkdownRenderer;
