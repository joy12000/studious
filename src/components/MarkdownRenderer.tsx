// src/components/MarkdownRenderer.tsx
import React, { useEffect, useRef } from 'react';
import { marked } from 'marked';
import { InlineMath, BlockMath } from 'react-katex';
import mermaid from 'mermaid';

import VisualRenderer from './VisualRenderer';
import { normalizeMermaidCode } from '../lib/markdownUtils';
import 'highlight.js/styles/github-dark.css';
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
  // (주의: 너무 많은 치환은 원문 의도를 바꿀 수 있으니 최소한만)
  out = out.replace(/&quot;/g, '"').replace(/&#39;/g, "'");

  // 3) 흔한 잘못된 화살표 스페이싱 보정 (--- > 등)
  out = out.replace(/---\s+>/g, '--->').replace(/-\s*-\s*>/g, '-->').replace(/-\s*\.->/g, '-.->');

  return out;
}

/* mermaid.parse 검사(에러 메시지 반환 or null) */
async function tryParseMermaid(code: string): Promise<string | null> {
  try {
    // some mermaid versions throw big exceptions — we still try/catch, but be aware.
    await mermaid.parse(code);
    return null;
  } catch (e: any) {
    // e.str 에 파서 친화적 문구가 들어오는 경우가 많음
    return e?.str || e?.message || String(e);
  }
}

/* ---------------------------- component ---------------------------- */

const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      flowchart: { htmlLabels: false }, // 필요시 true로 바꿀 수 있음
      securityLevel: 'loose', // HTML 레이블 또는 <br/>을 사용하려면 'loose' 권장. (주의: 보안 영향)
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
          // unknown: leave as-is but try minimal transforms later if needed
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

        // 5) 모든 시도 실패 -> 에러 UI (원문과 마지막 파서 메시지 노출)
        pre.innerHTML = `<div style="color:red;text-align:left;white-space:pre-wrap;padding:8px;border:1px solid #f5c6cb;border-radius:6px;background:#fff0f0;">
Mermaid 파싱 실패
--- 원문 ---
${escapeHtml(raw).slice(0, 2000)}
--- 파서 메시지 ---
${escapeHtml(String(errCand || errRaw))}
</div>`;
        pre.setAttribute('data-processed', 'true');
      }

      // 실제 렌더링 시도
      if (toRender.length > 0) {
        try {
          await mermaid.run({ nodes: toRender });
        } catch (e) {
          console.error('Mermaid.run error:', e);
          toRender.forEach((n) => {
            n.innerHTML = `<div style="color:red;text-align:center;">다이어그램 렌더링 오류</div>`;
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
            <summary className="cursor-pointer p-4 font-semibold" dangerouslySetInnerHTML={{ __html: marked.parseInline(summaryContent, { gfm: true, breaks: true }) }} />
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

  return <div ref={containerRef}>{renderParts()}</div>;
};

export default MarkdownRenderer;

/* ---------------------------- utilities ---------------------------- */
function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
