// src/components/MarkdownRenderer.tsx
import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { InlineMath, BlockMath } from 'react-katex';
import mermaid from 'mermaid';

import VisualRenderer from './VisualRenderer';
import { normalizeMermaidCode } from '../lib/markdownUtils';
import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';

/**
 * MarkdownRenderer.tsx
 * - mermaid 블록을 안전하게 렌더하기 위한 보수적 파이프라인 포함
 * - 전략:
 *   1) mermaid.parse로 사전 검사
 *   2) flowchart-like이면 normalizeMermaidCode 적용
 *   3) 실패 시 원문으로 다시 시도
 *   4) 그래도 실패 시 최소 안전 변환(minimalSafeTransforms)으로 한 번 더 시도
 *   5) 여전히 실패면 에러 UI(사용자 친화적)
 */

interface Props {
  content: string;
}

/* ---------------------------- helpers ---------------------------- */

const normalizeMathUnicode = (s: string) =>
  String(s || '').replace(/\u00B2/g, '^2').replace(/\u00B3/g, '^3');

const renderInlineContent = (text: string) => {
  if (!text) return null;
  const regex = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;
  const parts = text.split(regex);
  return parts.map((part, i) => {
    if (!part) return null;
    const t = part.trim();
    if (t.startsWith('$$') && t.endsWith('$$')) return <BlockMath key={i}>{normalizeMathUnicode(part.slice(2, -2))}</BlockMath>;
    if (t.startsWith('$') && t.endsWith('$'))   return <InlineMath key={i}>{normalizeMathUnicode(part.slice(1, -1))}</InlineMath>;
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

/** 최소 안전 변환 — 원문을 크게 바꾸지 않으면서 mermaid 파서에 걸리기 쉬운 몇 가지만 정리 */
function minimalSafeTransforms(code: string): string {
  let out = code;
  // HTML <br> 를 self-closing 권장 형태로 바꿈(mermaid가 일부 환경에서 좀 더 잘 처리)
  out = out.replace(/<br\s*\/?>/gi, '<br/>');
  // 흔한 HTML 엔티티(very small set) 디코딩 — 너무 많이 디코딩하면 원문 의도가 바뀜
  out = out.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  // 화살표 스페이싱 보정
  out = out.replace(/---\s+>/g, '--->').replace(/-\s*-\s*>/g, '-->').replace(/-\s*\.->/g, '-.->');
  return out;
}

/** mermaid.parse 검사(에러 메시지 반환 or null) */
async function tryParseMermaid(code: string): Promise<string | null> {
  try {
    await mermaid.parse(code);
    return null;
  } catch (e: any) {
    // mermaid 에러 객체가 가진 유용한 필드(str 등)를 우선 사용
    return e?.str || e?.message || String(e);
  }
}

/* 안전한 헤더 자동 보강 (헤더가 없을 때 flowchart 가능성 판단 후 'graph TD' 삽입) */
const ensureDiagramHeader = (code: string): string => {
  const src = String(code || '').trim();
  const HEADER_RE = /^(graph|flowchart|sequenceDiagram|gantt|pie|erDiagram|journey|classDiagram|stateDiagram(?:-v2)?|gitGraph|mindmap|timeline|quadrantChart|sankey|requirementDiagram|xychart-beta)\b/i;
  if (HEADER_RE.test(src)) return code;
  const looksFlow =
    /(^|\n)\s*subgraph\b/i.test(src) ||
    /(^|\n)\s*[A-Za-z_][\w-]*\s*(\[\[?|\(\(?|\{\{?|\{>)/.test(src) ||
    /(-->|-{2,3}|-\.->|<-->)/.test(src) ||
    /(^|\n)\s*(style|linkStyle)\b/i.test(src);
  return looksFlow ? `graph TD\n${code}` : code;
};

/* 안전하게 HTML escape */
function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ---------------------------- component ---------------------------- */

const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [modalMermaidCode, setModalMermaidCode] = useState<string | null>(null);
  const modalMermaidRef = useRef<HTMLDivElement>(null);

  /* 전역 초기화 1회 — startOnLoad: false 권장(경쟁상태 회피) */
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      flowchart: { htmlLabels: false }, // 프로젝트 요구에 따라 변경 가능
      securityLevel: 'loose',
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
    });
  }, []);

  /* 본문 mermaid 렌더 루틴 (안정화된 후보정/폴백 단계 포함) */
  useEffect(() => {
    if (!containerRef.current) return;
    const pres = containerRef.current.querySelectorAll<HTMLPreElement>('pre.mermaid:not([data-processed])');
    if (pres.length === 0) return;

    (async () => {
      const toRender: HTMLElement[] = [];

      for (const pre of Array.from(pres)) {
        // pre 내부에 <code>가 있으면 그 텍스트를 원문으로 취급
        const codeEl = pre.querySelector('code');
        const raw = String((codeEl ? codeEl.textContent : pre.textContent) || '').trim();
        if (!raw) {
          pre.setAttribute('data-processed', 'true');
          continue;
        }

        // 디버그 로그 (개발시 유용)
        // console.debug('[Mermaid] raw block:', raw);

        // 1) candidate 결정: flowchart-like만 강한 정규화 적용
        let candidate = raw;
        let usedNormalization = false;

        if (isSequenceDiagram(raw)) {
          // sequence: heavy normalization 피함 (시퀀스 문법은 flow 전용 정규화에 의해 쉽게 깨짐)
          candidate = raw.replace(/<br\s*\/?>/gi, '<br/>');
        } else if (isFlowchartLike(raw)) {
          try {
            candidate = normalizeMermaidCode(raw); // 네가 만든 정교 유틸
            usedNormalization = true;
          } catch (err) {
            console.warn('[Mermaid] normalizeMermaidCode threw, falling back to raw:', err);
            candidate = raw;
            usedNormalization = false;
          }
        } else {
          candidate = raw;
        }

        // 2) header 보강 (graph TD 등)
        candidate = ensureDiagramHeader(candidate);

        // 3) candidate로 parse 시도
        let errCand = await tryParseMermaid(candidate);
        if (!errCand) {
          // 파싱 OK -> 실제 DOM에 안전하게 텍스트 주입
          // **중요**: innerHTML이 아니라 textContent로 넣어야 mermaid가 똑바로 읽음
          pre.textContent = candidate;
          toRender.push(pre);
          continue;
        }

        // 4) candidate 실패 -> 원문(raw)으로 재시도 (폴백)
        const errRaw = await tryParseMermaid(raw);
        if (!errRaw) {
          pre.textContent = raw;
          toRender.push(pre);
          continue;
        }

        // 5) raw도 실패 -> 최소 안전 변환 시도(한 번만)
        const minimal = minimalSafeTransforms(raw);
        if (minimal !== raw) {
          const minimalWithHeader = ensureDiagramHeader(minimal);
          const errMin = await tryParseMermaid(minimalWithHeader);
          if (!errMin) {
            pre.textContent = minimalWithHeader;
            toRender.push(pre);
            continue;
          }
        }

        // 6) 모든 시도 실패 -> 에러 UI (원문 + 파서 메시지 보여줌)
        const lastErr = errCand || errRaw || 'Unknown parse failure';
        pre.innerHTML = `<div style="color:#6b0216;background:#fff0f0;padding:10px;border-radius:6px;border:1px solid #f5c6cb;white-space:pre-wrap;">
<strong>Mermaid 파싱 실패</strong>
--- 원문(일부) ---
${escapeHtml(raw).slice(0, 2000)}
--- 파서 메시지 ---
${escapeHtml(String(lastErr))}
</div>`;
        pre.setAttribute('data-processed', 'true');
      }

      // 7) 실제 렌더링 시도 (성공 후보들)
      if (toRender.length > 0) {
        try {
          await mermaid.run({ nodes: toRender });
        } catch (e) {
          console.error('Mermaid 렌더링 실패:', e);
          toRender.forEach((n) => {
            n.innerHTML = `<div style="color:red;text-align:center;white-space:pre-wrap;">다이어그램 렌더링 오류</div>`;
            n.setAttribute('data-processed', 'true');
          });
        } finally {
          toRender.forEach((n) => n.setAttribute('data-processed', 'true'));
        }
      }
    })();
  }, [content]);

  /* 모달 렌더 (클릭하면 크게 보기) */
  useEffect(() => {
    const renderModalMermaid = async () => {
      if (!modalMermaidCode || !modalMermaidRef.current) return;
      modalMermaidRef.current.innerHTML = '';
      const pre = document.createElement('pre');
      pre.className = 'mermaid';

      // 같은 안전 파이프라인: normalize -> header -> parse -> minimal -> 실패면 에러 UI
      let candidate = modalMermaidCode;
      if (!isSequenceDiagram(candidate) && isFlowchartLike(candidate)) {
        try { candidate = normalizeMermaidCode(candidate); } catch { candidate = modalMermaidCode; }
      }
      candidate = ensureDiagramHeader(candidate);

      const err = await tryParseMermaid(candidate);
      if (!err) {
        pre.textContent = candidate;
        modalMermaidRef.current.appendChild(pre);
        try { await mermaid.run({ nodes: [pre] }); }
        catch (e) {
          console.error('모달에서 Mermaid 렌더링 실패:', e);
          modalMermaidRef.current.innerText = '다이어그램 렌더링 오류';
        }
        return;
      }

      // 원문/최소 변환 폴백
      const errRaw = await tryParseMermaid(modalMermaidCode);
      if (!errRaw) { pre.textContent = modalMermaidCode; modalMermaidRef.current.appendChild(pre); try { await mermaid.run({ nodes: [pre] }); } catch(e) { modalMermaidRef.current.innerText = '다이어그램 렌더링 오류'; } return; }

      const minimal = minimalSafeTransforms(modalMermaidCode);
      if (minimal !== modalMermaidCode) {
        const errMin = await tryParseMermaid(ensureDiagramHeader(minimal));
        if (!errMin) { pre.textContent = ensureDiagramHeader(minimal); modalMermaidRef.current.appendChild(pre); try { await mermaid.run({ nodes: [pre] }); } catch(e) { modalMermaidRef.current.innerText = '다이어그램 렌더링 오류'; } return; }
      }

      modalMermaidRef.current.innerHTML = `<div style="color:#6b0216;background:#fff0f0;padding:10px;border-radius:6px;border:1px solid #f5c6cb;white-space:pre-wrap;">
Mermaid 파싱 실패 (모달)
--- 원문(일부) ---
${escapeHtml(modalMermaidCode).slice(0,2000)}
--- 파서 메시지 ---
${escapeHtml(String(err))}
</div>`;
    };
    renderModalMermaid();
  }, [modalMermaidCode]);

  /* ---------------------------- renderParts ---------------------------- */
  const renderParts = () => {
    if (!content) return null;
    const blockRegex = /(```(?:mermaid|visual|chart|[\s\S]*?)```|<details[\s\S]*?<\/details>|[\s\S]+?(?=```|<details|$))/g;
    const blocks = content.match(blockRegex) || [];

    return blocks.map((block, i) => {
      const trimmed = block.trim();

      if (trimmed.startsWith('```mermaid')) {
        const firstNL = trimmed.indexOf('\n');
        const code = trimmed.slice(firstNL + 1, -3); // 원문 그대로 넣고 useEffect에서 처리
        return (
          <div className="flex justify-center my-4" key={i} onClick={() => setModalMermaidCode(code)} title="클릭하여 크게 보기">
            <pre className="mermaid"><code>{code}</code></pre>
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

  return (
    <div ref={containerRef}>
      {renderParts()}

      {modalMermaidCode && (
        <div className="mermaid-modal-overlay" onClick={() => setModalMermaidCode(null)} style={{position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.5)'}}>
          <div className="mermaid-modal-content" onClick={(e) => e.stopPropagation()} style={{width:'80%',height:'80%',background:'#fff',padding:10,borderRadius:8,overflow:'auto'}}>
            <button onClick={() => setModalMermaidCode(null)} style={{float:'right'}}>×</button>
            <div ref={modalMermaidRef} className="w-full h-full flex items-center justify-center"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarkdownRenderer;
