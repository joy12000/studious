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

/* ────────────────────────────────────────────────────────────────────────────
   수식 내 유니코드 지수 등을 ASCII 지수로 정규화 (KaTeX 경고 완화)
   ──────────────────────────────────────────────────────────────────────────── */
const normalizeMathUnicode = (s: string) =>
  s.replace(/\u00B2/g, '^2') // ²
   .replace(/\u00B3/g, '^3'); // ³

/* ────────────────────────────────────────────────────────────────────────────
   인라인 텍스트/수식 렌더
   ──────────────────────────────────────────────────────────────────────────── */
const renderInlineContent = (text: string) => {
  if (!text) return null;
  const regex = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (!part) return null;
    const t = part.trim();

    if (t.startsWith('$$') && t.endsWith('$$')) {
      return <BlockMath key={i}>{normalizeMathUnicode(part.slice(2, -2))}</BlockMath>;
    }
    if (t.startsWith('$') && t.endsWith('$')) {
      return <InlineMath key={i}>{normalizeMathUnicode(part.slice(1, -1))}</InlineMath>;
    }

    return (
      <span
        key={i}
        dangerouslySetInnerHTML={{
          __html: marked.parseInline(part, { gfm: true, breaks: true }) as string
        }}
      />
    );
  });
};

/* ────────────────────────────────────────────────────────────────────────────
   Mermaid 유틸: 타입 감지 및 파싱 체크
   ──────────────────────────────────────────────────────────────────────────── */
const FLOW_HEADER_RE = /^(graph|flowchart)\b/i;
const ANY_HEADER_RE =
  /^(graph|flowchart|sequenceDiagram|gantt|pie|erDiagram|journey|classDiagram|stateDiagram(?:-v2)?|gitGraph|mindmap|timeline|quadrantChart|sankey|requirementDiagram|xychart-beta)\b/i;

const isFlowchartOrGraph = (code: string): boolean => {
  const first = String(code || '').trimStart().split('\n')[0].trim();
  const m = first.match(ANY_HEADER_RE);
  return !!(m && FLOW_HEADER_RE.test(m[0]));
};

const tryParseMermaid = async (code: string): Promise<string | null> => {
  try {
    await mermaid.parse(code);
    return null;
  } catch (e: any) {
    return e?.str || e?.message || 'Mermaid parse error';
  }
};

/* ────────────────────────────────────────────────────────────────────────────
   컴포넌트
   ──────────────────────────────────────────────────────────────────────────── */
const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Mermaid 전역 초기화 (문서 권장: initialize → run). startOnLoad:false 후 수동 run 사용.
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      // 줄바꿈 정책:
      // - htmlLabels: true (기본값) → 라벨에서 <br> 사용
      // - htmlLabels: false → 라벨에서 \n(리터럴) 사용
      // 팀 정책에 맞게 선택하세요. (여기서는 false 가정)
      flowchart: { htmlLabels: false },
      securityLevel: 'loose',
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
    });
  }, []);

  // Mermaid 블록 렌더
  useEffect(() => {
    if (!containerRef.current) return;
    const mermaidBlocks = containerRef.current.querySelectorAll<HTMLElement>('pre.mermaid:not([data-processed])');
    if (mermaidBlocks.length === 0) return;

    (async () => {
      const renderables: HTMLElement[] = [];

      for (const el of Array.from(mermaidBlocks)) {
        // 원문 코드 확보 (pre.mermaid 내부 텍스트)
        const raw = (el.textContent || '').trim();

        // flowchart/graph 인 경우에만 최소 후보정 적용
        const candidate = isFlowchartOrGraph(raw) ? normalizeMermaidCode(raw) : raw;

        // 1차: 후보정 버전 파싱 시도
        let err = await tryParseMermaid(candidate);
        if (!err) {
          el.textContent = candidate;   // 원문 대신 후보정 코드로 교체
          renderables.push(el);
          continue;
        }

        // 2차: 원문 그대로 파싱 시도 (후보정이 오히려 해친 경우 대비)
        err = await tryParseMermaid(raw);
        if (!err) {
          el.textContent = raw;         // 원문 유지
          renderables.push(el);
          continue;
        }

        // 3차: 실패 표시 + 원문 출력
        el.innerHTML = `<div style="color:red;text-align:center;white-space:pre-wrap;">
Mermaid 파싱 오류:
${String(err)}
</div>`;
        el.setAttribute('data-processed', 'true');
      }

      if (renderables.length > 0) {
        try {
          await mermaid.run({ nodes: renderables }); // v10+ 권장 API
        } catch (e) {
          // run 중 실패 (렌더 단계 에러)
          renderables.forEach((el) => {
            el.innerHTML = `<div style="color:red;text-align:center;">다이어그램 렌더링 오류</div>`;
          });
        } finally {
          renderables.forEach((el) => el.setAttribute('data-processed', 'true'));
        }
      }
    })();
  }, [content]);

  /* 블록 분리 렌더 */
  const renderParts = () => {
    if (!content) return null;

    const blockRegex =
      /(```(?:mermaid|visual|chart|[\s\S]*?)```|<details[\s\S]*?<\/details>|[\s\S]+?(?=```|<details|$))/g;
    const blocks = content.match(blockRegex) || [];

    return blocks.map((block, i) => {
      const trimmed = block.trim();

      // Mermaid 다이어그램: <pre class="mermaid">에 "그대로" 텍스트를 넣는다 (code 태그 사용 X)
      // 공식 권장: .mermaid 요소를 수집하여 mermaid.run 호출. :contentReference[oaicite:0]{index=0}
      if (trimmed.startsWith('```mermaid')) {
        const firstNL = trimmed.indexOf('\n');
        const code = trimmed.slice(firstNL + 1, -3).trim();
        return (
          <div className="flex justify-center my-4" key={i}>
            <pre className="mermaid">{code}</pre>
          </div>
        );
      }

      // 비주얼 시각화 컴포넌트
      if (trimmed.startsWith('```visual')) {
        const firstNL = trimmed.indexOf('\n');
        const jsonText = trimmed.slice(firstNL + 1, -3).trim();
        try {
          const visualData = JSON.parse(jsonText);
          return (
            <div className="my-4" key={i}>
              <VisualRenderer config={visualData} />
            </div>
          );
        } catch {
          return <pre key={i} style={{ color: 'red' }}>Visual JSON Error</pre>;
        }
      }

      // 기타 코드블록/마크다운
      if (trimmed.startsWith('```')) {
        const html = marked.parse(trimmed, { gfm: true, breaks: true }) as string;
        return <div key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      }

      // details/summary
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
              dangerouslySetInnerHTML={{
                __html: marked.parseInline(summaryContent, { gfm: true, breaks: true })
              }}
            />
            <div className="p-4 border-t">
              <MarkdownRenderer content={mainContent} />
            </div>
          </details>
        );
      }

      // 일반 문단
      if (trimmed) {
        return trimmed.split(/\n\n+/).map((p, j) => (
          <p key={`${i}-${j}`}>{renderInlineContent(p)}</p>
        ));
      }
      return null;
    });
  };

  return <div ref={containerRef}>{renderParts()}</div>;
};

export default MarkdownRenderer;
