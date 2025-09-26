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

/** 인라인 수식/텍스트 렌더 */
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

    // marked v5+: marked.parseInline 권장
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

const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [modalMermaidCode, setModalMermaidCode] = useState<string | null>(null);
  const modalMermaidRef = useRef<HTMLDivElement>(null);

  /** ✅ Mermaid 전역 초기화: 한 번만 */
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      // 라벨 줄바꿈은 \n(리터럴)로 처리하기 위해 htmlLabels:false
      flowchart: { htmlLabels: false },
      // 필요 시 보안/테마
      securityLevel: 'loose', // HTML 라벨을 쓰지 않아도 loose가 더 관용적
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default'
    });
  }, []);

  /** 코드 검증용: 어디서 깨지는지 즉시 확인 */
  const tryParseMermaid = (code: string): string | null => {
    try {
      mermaid.parse(code);
      return null;
    } catch (e: any) {
      // e?.str(mermaid 9.x) 또는 e?.message(mermaid 10.x)
      return e?.str || e?.message || 'Unknown mermaid parse error';
    }
  };

  /** 코드블록 내 mermaid 렌더 */
  useEffect(() => {
    const renderMermaidDiagrams = () => {
      if (!containerRef.current) return;

      // 아직 처리 안 한 것만 잡음
      const mermaidElements = containerRef.current.querySelectorAll<HTMLElement>(
        'pre.mermaid:not([data-processed])'
      );
      if (mermaidElements.length === 0) return;

      // DOM 반영 직후 실행
      requestAnimationFrame(async () => {
        try {
          // 렌더 전에 각 코드블록을 정규화(normalize)하고, 검증(parse)까지 수행
          const nodes: HTMLElement[] = [];
          mermaidElements.forEach((pre) => {
            const codeEl = pre.querySelector('code');
            // 코드 저장 위치: <pre class="mermaid"><code>...</code></pre>
            const raw = (codeEl?.textContent || '').trim();

            // 후보정(유틸)
            const fixed = normalizeMermaidCode(raw);

            // ✅ HTML이 아니라 "순수 텍스트"로 넣어야 엔티티/태그 혼동 없음
            if (codeEl) codeEl.textContent = fixed;
            else pre.textContent = fixed;

            // 빠른 파서 검증
            const err = tryParseMermaid(fixed);
            if (err) {
              // 실패한 블록은 즉시 에러 출력하고 렌더 목록에서 제외
              pre.innerHTML = `<div style="color:red;text-align:center;white-space:pre-wrap;">다이어그램 파싱 오류:\n${err}</div>`;
              pre.setAttribute('data-processed', 'true');
            } else {
              nodes.push(pre);
            }
          });

          if (nodes.length > 0) {
            await mermaid.run({ nodes });
            nodes.forEach((n) => n.setAttribute('data-processed', 'true'));
          }
        } catch (error) {
          console.error('Mermaid 렌더링 실패:', error);
          mermaidElements.forEach((el) => {
            el.innerHTML = '다이어그램 렌더링 오류';
            el.setAttribute('style', 'color: red; text-align: center;');
            el.setAttribute('data-processed', 'true');
          });
        }
      });
    };

    renderMermaidDiagrams();
  }, [content]);

  /** 모달 내 렌더 */
  useEffect(() => {
    const renderModalMermaid = async () => {
      if (!modalMermaidCode || !modalMermaidRef.current) return;

      modalMermaidRef.current.innerHTML = '';
      const pre = document.createElement('pre');
      pre.className = 'mermaid';

      // ✅ 모달에서도 항상 textContent로 넣기
      const fixed = normalizeMermaidCode(modalMermaidCode);
      pre.textContent = fixed;

      // 빠른 검증
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

  /** 마크다운을 “블록” 단위로 나눠 렌더 */
  const renderParts = () => {
    if (!content) return null;

    // 코드블록/디테일 블록/일반 텍스트를 덩어리로 분리
    const blockRegex =
      /(```(?:mermaid|visual|chart|[\s\S]*?)```|<details[\s\S]*?<\/details>|[\s\S]+?(?=```|<details|$))/g;
    const blocks = content.match(blockRegex) || [];

    return blocks.map((block, i) => {
      const trimmedBlock = block.trim();

      if (trimmedBlock.startsWith('```mermaid')) {
        // ```mermaid + 개행 = 길이 11이지만, 안전하게 첫 개행 위치로 자르는 쪽이 확실
        const firstNL = trimmedBlock.indexOf('\n');
        const code = trimmedBlock.slice(firstNL + 1, -3).trim();

        return (
          <div
            className="flex justify-center my-4 cursor-zoom-in"
            key={i}
            onClick={() => setModalMermaidCode(code)}
            title="클릭하여 크게 보기"
          >
            {/* 원본 코드는 여기선 그대로 넣고, useEffect에서 normalize + render */}
            <pre className="mermaid"><code>{code}</code></pre>
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
          <details
            key={i}
            className="prose dark:prose-invert max-w-none my-4 border rounded-lg"
          >
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
