// src/components/MarkdownRenderer.tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';
import { InlineMath, BlockMath } from 'react-katex';
import mermaid from 'mermaid';
import JointJSRenderer from './JointJSRenderer';
import VisualRenderer from './VisualRenderer';
import 'katex/dist/katex.min.css';

/**
 * 지원되는 특수 코드펜스:
 * ```mermaid
 * graph TD; A-->B
 * ```
 *
 * ```jointjs
 * { "cells": [ ... JointJS JSON ... ] }
 * ```
 *
 * ```visual
 * { "type": "svg", "props": { "width": 400, "height": 200, "children": [...] } }
 * ```
 *
 * 수식(LaTeX):
 *   - 블록: $$ E = mc^2 $$
 *   - 인라인: $a^2 + b^2 = c^2$
 */

type MarkdownRendererProps = {
  content: string;
  className?: string;
};

const codeFenceRe = /```(\w+)?\n([\s\S]*?)```/g;

/** Mermaid 초기화 (다크모드 대응) */
const initMermaid = () => {
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme:
        typeof document !== 'undefined' &&
        document.documentElement.classList.contains('dark')
          ? 'dark'
          : 'default',
      securityLevel: 'loose',
    });
  } catch {
    /* no-op */
  }
};

const escapeHtml = (str: string) =>
  str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

let mermaidSeq = 0;
const MermaidBlock: React.FC<{ code: string }> = ({ code }) => {
  const ref = useRef<HTMLDivElement>(null);
  const id = useMemo(() => `mermaid-${++mermaidSeq}`, []);

  useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;

    const render = async () => {
      try {
        initMermaid();
        const { svg } = await mermaid.render(id, code);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          // 테두리(인식 성공 표시)
          ref.current.style.border = '1px solid #22c55e';
          ref.current.style.borderRadius = '8px';
          ref.current.style.padding = '8px';
        }
      } catch (err: any) {
        if (ref.current) {
          ref.current.innerHTML =
            `<pre style="white-space:pre-wrap;color:#ef4444;">Mermaid Syntax Error:\n` +
            escapeHtml(err?.message || String(err)) +
            `\n\n` +
            escapeHtml(code) +
            `</pre>`;
          // 테두리(오류 표시)
          ref.current.style.border = '1px solid #ef4444';
          ref.current.style.borderRadius = '8px';
          ref.current.style.padding = '8px';
        }
      }
    };
    render();
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  return (
    <div
      ref={ref}
      aria-label="Mermaid diagram"
      style={{ minHeight: 24, overflow: 'auto' }}
    />
  );
};

/** 텍스트에서 $$...$$ (블록) 과 $...$ (인라인) 수식을 분리 */
function splitMathSegments(text: string): Array<{ kind: 'block'|'inline'|'text', value: string }> {
  // 1) 블록 수식 우선 분리
  const blockParts = text.split(/(\$\$[\s\S]+?\$\$)/g);
  const out: Array<{ kind: 'block'|'inline'|'text', value: string }> = [];

  for (const part of blockParts) {
    if (part.startsWith('$$') && part.endsWith('$$') && part.length >= 4) {
      out.push({ kind: 'block', value: part.slice(2, -2).trim() });
    } else {
      // 2) 남은 텍스트에서 인라인 수식 분리
      const inlineParts = part.split(/(\$[^$\n]+?\$)/g);
      for (const ip of inlineParts) {
        if (ip.startsWith('$') && ip.endsWith('$') && ip.length >= 2) {
          out.push({ kind: 'inline', value: ip.slice(1, -1) });
        } else if (ip) {
          out.push({ kind: 'text', value: ip });
        }
      }
    }
  }
  return out;
}

/** 일반 마크다운 -> HTML 변환 (코드펜스는 상위에서 분리됨) */
function MarkdownHtml({ text }: { text: string }) {
  const html = useMemo(() => {
    // marked 기본 설정
    marked.setOptions({ breaks: true, gfm: true });
    return marked.parse(text) as string;
  }, [text]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // content 를 코드펜스 기준으로 토큰화
  const tokens = useMemo(() => {
    const result: Array<{ type: 'md'|'mermaid'|'jointjs'|'visual'|'latex-block', value: string }> = [];
    let lastIndex = 0;
    let m: RegExpExecArray | null;

    while ((m = codeFenceRe.exec(content)) !== null) {
      const [full, langRaw, code] = m;
      const lang = (langRaw || '').toLowerCase().trim();
      // 이전 일반 텍스트 추가
      if (m.index > lastIndex) {
        result.push({ type: 'md', value: content.slice(lastIndex, m.index) });
      }
      if (lang === 'mermaid') {
        result.push({ type: 'mermaid', value: code.trim() });
      } else if (lang === 'jointjs') {
        result.push({ type: 'jointjs', value: code.trim() });
      } else if (lang === 'visual') {
        result.push({ type: 'visual', value: code.trim() });
      } else if (lang === 'latex' || lang === 'tex' || lang === 'math') {
        result.push({ type: 'latex-block', value: code.trim() });
      } else {
        // 기타 코드블록은 보통 마크다운으로 그대로
        result.push({ type: 'md', value: full });
      }
      lastIndex = m.index + full.length;
    }
    // 남은 꼬리 텍스트
    if (lastIndex < content.length) {
      result.push({ type: 'md', value: content.slice(lastIndex) });
    }
    return result;
  }, [content]);

  // 렌더
  return (
    <div ref={containerRef} className={className}>
      {tokens.map((t, i) => {
        switch (t.type) {
          case 'mermaid':
            return (
              <div key={`m-${i}`} style={{ margin: '12px 0' }}>
                <MermaidBlock code={t.value} />
              </div>
            );
          case 'jointjs': {
            let json: any = null;
            let error: string | null = null;
            try {
              json = JSON.parse(t.value);
            } catch (e: any) {
              error = e?.message || String(e);
            }
            return (
              <div
                key={`j-${i}`}
                style={{
                  margin: '12px 0',
                  border: error ? '1px solid #ef4444' : '1px solid #22c55e',
                  borderRadius: 8,
                  padding: 8,
                }}
              >
                {error ? (
                  <pre style={{ whiteSpace: 'pre-wrap', color: '#ef4444' }}>
                    JointJS JSON Parse Error: {error}{'\n'}
                    {t.value}
                  </pre>
                ) : (
                  <JointJSRenderer data={json} />
                )}
              </div>
            );
          }
          case 'visual': {
            let json: any = null;
            let error: string | null = null;
            try {
              json = JSON.parse(t.value);
            } catch (e: any) {
              error = e?.message || String(e);
            }
            return (
              <div
                key={`v-${i}`}
                className="visual-root"
                style={{
                  margin: '12px 0',
                  border: error ? '1px solid #ef4444' : '1px solid #22c55e',
                  borderRadius: 8,
                  padding: 8,
                }}
              >
                {error ? (
                  <pre style={{ whiteSpace: 'pre-wrap', color: '#ef4444' }}>
                    Visual JSON Parse Error: {error}{'\n'}
                    {t.value}
                  </pre>
                ) : (
                  <VisualRenderer config={json} />
                )}
              </div>
            );
          }
          case 'latex-block':
            return (
              <div key={`lb-${i}`} style={{ margin: '12px 0' }}>
                <BlockMath math={t.value} />
              </div>
            );
          case 'md': {
            // 일반 텍스트 내부의 인라인/블록 수식 처리
            const segments = splitMathSegments(t.value);
            return (
              <div key={`md-${i}`}>
                {segments.map((seg, k) => {
                  if (seg.kind === 'block') return <BlockMath key={k} math={seg.value} />;
                  if (seg.kind === 'inline') return <InlineMath key={k} math={seg.value} />;
                  // 나머지는 마크다운 HTML
                  return <MarkdownHtml key={k} text={seg.value} />;
                })}
              </div>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
};

export default MarkdownRenderer;
