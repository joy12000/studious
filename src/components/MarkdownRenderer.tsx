// src/components/MarkdownRenderer.tsx
import React, { useEffect, useRef } from 'react';
import { marked } from 'marked';
import { InlineMath, BlockMath } from 'react-katex';
import mermaid from 'mermaid';
import VisualRenderer from './VisualRenderer';
import { normalizeMermaidCode } from '../lib/markdownUtils';
import 'highlight.js/styles/github-dark.css';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface Props { content: string; }

/* ---------------------------- helpers ---------------------------- */

const normalizeMathUnicode = (s: string) =>
  s.replace(/\u00B2/g, '^2').replace(/\u00B3/g, '^3');

const renderInlineContent = (text: string) => {
  if (!text) return null;
  const regex = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;
  const parts = text.split(regex);
  return parts.map((part, i) => {
    if (!part) return null;
    const t = part.trim();
    if (t.startsWith('$$') && t.endsWith('$$')) return <BlockMath key={i}>{normalizeMathUnicode(part.slice(2, -2))}</BlockMath>;
    if (t.startsWith('$') && t.endsWith('$')) return <InlineMath key={i}>{normalizeMathUnicode(part.slice(1, -1))}</InlineMath>;
    return <span key={i} dangerouslySetInnerHTML={{ __html: marked.parseInline(part, { gfm: true, breaks: true }) as string }} />;
  });
};

const firstMeaningfulLine = (s: string) => (s || '').split(/\r?\n/).map(l => l.trim()).find(Boolean) || '';
const isSequenceDiagram = (code: string) => /^sequenceDiagram\b/i.test(firstMeaningfulLine(code));
const isFlowchartLike = (code: string) =>
  /(^|\n)\s*subgraph\b/i.test(code) ||
  /(^|\n)\s*[A-Za-z_][\w-]*\s*(\[\[?|\(\(?|\{\{?|\{>)/.test(code) ||
  /(-->|-{2,3}|-\.->|<-->)/.test(code) ||
  /(^|\n)\s*(style|linkStyle)\b/i.test(code);

/* 안전 최소 변환 (원문 그대로 실패했을 때 한 번만 시도) */
function minimalSafeTransforms(code: string): string {
  // 1) <br> 계열을 self-closing으로 (많은 Mermaid 구현에서 <br/> 권장)
  let out = code.replace(/<br\s*\/?>/gi, '<br/>');

  // 2) HTML 엔티티(최소) -> 디코드 (예: &quot; -> ")
  out = out.replace(/&quot;/g, '"').replace(/&#39;/g, "'");

  // 3) 흔한 잘못된 화살표 스페이싱 보정 (--- > 등)
  out = out.replace(/---\s+>/g, '--->').replace(/-\s*-\s*>/g, '-->').replace(/-\s*\.->/g, '-.->');

  return out;
}

/* mermaid.parse 검사(에러 메시지 반환 or null) */
async function tryParseMermaid(code: string): Promise<string | null> {
  try {
    await mermaid.parse(code);
    return null;
  } catch (e: any) {
    return e?.str || e?.message || String(e);
  }
}

/* HTML escape for small debug logging (kept short) */
function escapeHtml(s: string) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ---------------------------- component ---------------------------- */

const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  /* 전역 초기화 1회 */
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      flowchart: { htmlLabels: false },
      securityLevel: 'loose',
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const pres = containerRef.current.querySelectorAll<HTMLPreElement>('pre.mermaid:not([data-processed])');
    if (pres.length === 0) return;

    (async () => {
      const toRender: HTMLElement[] = [];

      for (const pre of Array.from(pres)) {
        const raw = (pre.textContent || '').trim();
        console.debug('[Mermaid] raw block:', raw);

        // 1) 후보정 경로: flowchart-like만 normalizeMermaidCode 적용
        let candidate = raw;
        let usedNormalization = false;

        if (isSequenceDiagram(raw)) {
          // 시퀀스는 후보정 대상에서 제외 — 대신 최소한의 <br/> 정리만 적용
          candidate = raw.replace(/<br\s*\/?>/gi, '<br/>');
          console.debug('[Mermaid] sequence -> skip heavy normalize, applied <br/> normalization');
        } else if (isFlowchartLike(raw)) {
          try {
            candidate = normalizeMermaidCode(raw);
            usedNormalization = true;
            console.debug('[Mermaid] flowchart candidate after normalizeMermaidCode:', candidate);
          } catch (err) {
            console.warn('[Mermaid] normalizeMermaidCode threw, falling back to raw:', err);
            candidate = raw;
            usedNormalization = false;
          }
        } else {
          // unknown: leave as-is but minimal transforms later if needed
          candidate = raw;
        }

        // 2) 후보정 코드로 파싱 시도
        const errCand = await tryParseMermaid(candidate);
        if (!errCand) {
          pre.textContent = candidate;
          toRender.push(pre);
          continue;
        }

        console.warn('[Mermaid] candidate parse failed:', errCand);

        // 3) 후보정 실패 -> 즉시 원문으로 파싱 재시도 (폴백)
        const errRaw = await tryParseMermaid(raw);
        if (!errRaw) {
          console.debug('[Mermaid] raw parsed successfully after candidate failed — using raw');
          pre.textContent = raw;
          toRender.push(pre);
          continue;
        }

        console.warn('[Mermaid] raw parse also failed:', errRaw);

        // 4) 원문도 실패 -> 안전 최소 변환 시도 (한 번만)
        const minimal = minimalSafeTransforms(raw);
        if (minimal !== raw) {
          const errMin = await tryParseMermaid(minimal);
          if (!errMin) {
            console.debug('[Mermaid] minimal transforms fixed it — using minimal-transformed text');
            pre.textContent = minimal;
            toRender.push(pre);
            continue;
          } else {
            console.warn('[Mermaid] minimal transforms still failed:', errMin);
          }
        }

        // 5) 모든 시도 실패 -> **숨김 처리** (화면에 에러 UI를 노출하지 않음)
        console.error('[Mermaid] All parse attempts failed. Hiding this block. Parser message:', errCand || errRaw);
        pre.style.display = 'none';
        pre.setAttribute('data-processed', 'true');
      }

      // 실제 렌더링 시도
      if (toRender.length > 0) {
        try {
          await mermaid.run({ nodes: toRender });
        } catch (e) {
          console.error('Mermaid.run error:', e);
          // 실패한 노드들을 개별적으로 숨김 처리
          toRender.forEach((n) => {
            n.style.display = 'none';
            n.setAttribute('data-processed', 'true');
          });
        } finally {
          toRender.forEach((n) => n.setAttribute('data-processed', 'true'));
        }
      }
    })();
  }, [content]);

  /* renderParts: 기존 로직 최대한 유지 (mermaid 블록은 원문을 <pre.mermaid>에 넣음) */
  const renderParts = () => {
    if (!content) return null;
    const blockRegex = /(```(?:mermaid|visual|chart|[\s\S]*?)```|<details[\s\S]*?<\/details>|[\s\S]+?(?=```|<details|$))/g;
    const blocks = content.match(blockRegex) || [];

    return blocks.map((block, i) => {
      const trimmed = block.trim();

      if (trimmed.startsWith('```mermaid')) {
        const firstNL = trimmed.indexOf('\n');
        const code = trimmed.slice(firstNL + 1, -3); // 원문 그대로 (후보정은 useEffect에서 처리)
        return (
          <div className="flex justify-center my-4" key={i}>
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
        } catch (e) {
          // JSON 파싱 실패인 경우: **아예 렌더하지 않음** (기존의 오류 텍스트 대신)
          console.warn('[Visual] JSON parse failed — hiding visual block', e);
          return null;
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
            <summary className="cursor-pointer p-4 font-semibold" dangerouslySetInnerHTML={{ __html: marked.parseInline(summaryContent, { gfm: true, breaks: true }) }} />
            <div className="p-4 border-t">
              <MarkdownRenderer content={mainContent} />
            </div>
          </details>
        );
      }

      if (trimmed) {
        const katexRegex = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;
        const parts = trimmed.split(katexRegex);

        const renderedParts = parts.map((part, index) => {
          if (part.match(katexRegex)) {
            const isBlock = part.startsWith('$$');
            const mathContent = part.slice(isBlock ? 2 : 1, isBlock ? -2 : -1);
            try {
              // Use react-katex components for proper React rendering
              if (isBlock) {
                return <BlockMath key={index}>{normalizeMathUnicode(mathContent)}</BlockMath>;
              }
              return <InlineMath key={index}>{normalizeMathUnicode(mathContent)}</InlineMath>;
            } catch (e) {
              console.error("KaTeX rendering failed:", e);
              return <span key={index}>{part}</span>; // Return original on error
            }
          } else {
            // Only process non-KaTeX parts with marked
            const html = marked.parse(part, { gfm: true, breaks: true }) as string;
            return <div key={index} dangerouslySetInnerHTML={{ __html: html }} />;
          }
        });

        return <div key={i}>{renderedParts}</div>;
      }
      return null;
    });
  };

  return <div ref={containerRef}>{renderParts()}</div>;
};

export default MarkdownRenderer;
