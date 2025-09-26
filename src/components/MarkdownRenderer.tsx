// src/components/MarkdownRenderer.tsx
import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { InlineMath, BlockMath } from 'react-katex';
import mermaid from 'mermaid';

import VisualRenderer from './VisualRenderer';
import { normalizeMermaidCode } from '../lib/markdownUtils';
import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';

interface Props { content: string; }

/** 인라인(수식/텍스트) 렌더 */
const renderInlineContent = (text: string) => {
  if (!text) return null;
  const regex = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;
  const parts = text.split(regex);
  return parts.map((part, i) => {
    if (!part) return null;
    const t = part.trim();
    if (t.startsWith('$$') && t.endsWith('$$')) return <BlockMath key={i}>{part.slice(2, -2)}</BlockMath>;
    if (t.startsWith('$') && t.endsWith('$'))   return <InlineMath key={i}>{part.slice(1, -1)}</InlineMath>;
    return <span key={i} dangerouslySetInnerHTML={{ __html: marked.parseInline(part, { gfm: true, breaks: true }) as string }} />;
  });
};

/** 헤더 없을 때 flowchart로 보강 */
const ensureDiagramHeader = (code: string): string => {
  const src = code.trim();
  const HEADER_RE = /^(graph|flowchart|sequenceDiagram|gantt|pie|erDiagram|journey|classDiagram|stateDiagram(?:-v2)?|gitGraph|mindmap|timeline|quadrantChart|sankey|requirementDiagram|xychart-beta)\b/i;
  if (HEADER_RE.test(src)) return code;
  const looksFlow =
    /(^|\n)\s*subgraph\b/i.test(src) ||
    /(^|\n)\s*[A-Za-z_][\w-]*\s*(\[\[?|\(\(?|\{\{?|\{>)/.test(src) ||
    /(-->|-{2,3}|-\.->|<-->)/.test(src) ||
    /(^|\n)\s*(style|linkStyle)\b/i.test(src);
  return looksFlow ? `graph TD\n${code}` : code;
};

const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [modalMermaidCode, setModalMermaidCode] = useState<string | null>(null);
  const modalMermaidRef = useRef<HTMLDivElement>(null);

  /* 전역 초기화 1회 */
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      flowchart: { htmlLabels: false },
      securityLevel: 'loose',
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
    });
  }, []);

  const tryParseMermaid = (code: string): string | null => {
    try { mermaid.parse(code); return null; }
    catch (e: any) { return e?.str || e?.message || 'Unknown mermaid parse error'; }
  };

  /* 본문 mermaid 렌더 */
  useEffect(() => {
    if (!containerRef.current) return;
    const mermaidElements = containerRef.current.querySelectorAll<HTMLElement>('pre.mermaid:not([data-processed])');
    if (mermaidElements.length === 0) return;

    requestAnimationFrame(async () => {
      const nodes: HTMLElement[] = [];

      mermaidElements.forEach((el) => {
        const raw = (el.textContent || '').trim();
        let fixed = normalizeMermaidCode(raw);
        fixed = ensureDiagramHeader(fixed);

        // ✅ 순수 텍스트로 주입
        el.textContent = fixed;

        const err = tryParseMermaid(fixed);
        if (err) {
          console.warn('[Mermaid parse fail] ----\n', fixed, '\n----');
          el.innerHTML = `<div style="color:red;text-align:center;white-space:pre-wrap;">다이어그램 파싱 오류:\n${err}</div>`;
          el.setAttribute('data-processed', 'true');
        } else {
          nodes.push(el);
        }
      });

      if (nodes.length > 0) {
        try { await mermaid.run({ nodes }); }
        catch (error) {
          console.error('Mermaid 렌더링 실패:', error);
          nodes.forEach((el) => { el.innerHTML = '다이어그램 렌더링 오류'; });
        } finally {
          nodes.forEach((n) => n.setAttribute('data-processed', 'true'));
        }
      }
    });
  }, [content]);

  /* 모달 mermaid 렌더 */
  useEffect(() => {
    const renderModalMermaid = async () => {
      if (!modalMermaidCode || !modalMermaidRef.current) return;
      modalMermaidRef.current.innerHTML = '';
      const pre = document.createElement('pre');
      pre.className = 'mermaid';

      let fixed = normalizeMermaidCode(modalMermaidCode);
      fixed = ensureDiagramHeader(fixed);
      pre.textContent = fixed;

      const err = tryParseMermaid(fixed);
      if (err) {
        console.warn('[Mermaid parse fail in modal] ----\n', fixed, '\n----');
        modalMermaidRef.current.innerHTML = `<div style="color:red;text-align:center;white-space:pre-wrap;">다이어그램 파싱 오류:\n${err}</div>`;
        return;
      }

      modalMermaidRef.current.appendChild(pre);
      try { await mermaid.run({ nodes: [pre] }); }
      catch (e) {
        console.error('모달에서 Mermaid 렌더링 실패:', e);
        modalMermaidRef.current.innerText = '다이어그램 렌더링 오류';
      }
    };
    renderModalMermaid();
  }, [modalMermaidCode]);

  /* 블록 분리 렌더 */
  const renderParts = () => {
    if (!content) return null;
    const blockRegex = /(```(?:mermaid|visual|chart|[\s\S]*?)```|<details[\s\S]*?<\/details>|[\s\S]+?(?=```|<details|$))/g;
    const blocks = content.match(blockRegex) || [];

    return blocks.map((block, i) => {
      const trimmed = block.trim();

      if (trimmed.startsWith('```mermaid')) {
        const firstNL = trimmed.indexOf('\n');
        const code = trimmed.slice(firstNL + 1, -3).trim();
        return (
          <div
            className="flex justify-center my-4 cursor-zoom-in"
            key={i}
            onClick={() => setModalMermaidCode(code)}
            title="클릭하여 크게 보기"
          >
            <pre className="mermaid">{code}</pre>
          </div>
        );
      }

      if (trimmed.startsWith('```visual')) {
        const firstNL = trimmed.indexOf('\n');
        const jsonText = trimmed.slice(firstNL + 1, -3).trim();
        try {
          const visualData = JSON.parse(jsonText);
          return <div className="my-4" key={i}><VisualRenderer config={visualData} /></div>;
        } catch {
          return <pre key={i} style={{ color: 'red' }}>Visual JSON Error</pre>;
        }
      }

      if (trimmed.startsWith('```')) {
        const html = marked.parse(trimmed, { gfm: true, breaks: true }) as string;
        return <div key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      }

      if (trimmed.startsWith('<details')) {
        const summaryMatch = trimmed.match(/<summary>([\s\S]*?)<\/summary>/);
        const summaryContent = summaryMatch ? summaryMatch[1] : '자세히 보기';
        const mainContentMatch = trimmed.match(/<\/summary>([\s\S]*)<\/details>/);
        let mainContent = mainContentMatch ? mainContentMatch[1] : '';
        mainContent = mainContent.trim().replace(/^<div>/, '').replace(/<\/div>$/, '').trim();

        return (
          <details key={i} className="prose dark:prose-invert max-w-none my-4 border rounded-lg">
            <summary
              className="cursor-pointer p-4 font-semibold"
              dangerouslySetInnerHTML={{ __html: marked.parseInline(summaryContent, { gfm: true, breaks: true }) }}
            />
            <div className="p-4 border-t">
              <MarkdownRenderer content={mainContent} />
            </div>
          </details>
        );
      }

      if (trimmed) {
        return trimmed.split(/\n\n+/).map((p, j) => (<p key={`${i}-${j}`}>{renderInlineContent(p)}</p>));
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
            <div ref={modalMermaidRef} className="w-full h-full flex items-center justify-center" />
          </div>
        </div>
      )}
    </div>
  );
};

export default MarkdownRenderer;
