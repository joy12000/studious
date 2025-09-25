// src/components/JointJSRenderer.tsx
import React, { useEffect, useRef, useState } from 'react';
// 환경에 따라 아래 대안을 사용하세요.
// import * as joint from '@joint/core'; const { dia, shapes } = joint as any;
import { dia, shapes } from '@joint/core';

interface Props {
  data?: any;
  height?: number;
}

const JointJSRenderer: React.FC<Props> = ({ data, height = 360 }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [cellCount, setCellCount] = useState<number>(-1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [svgInfo, setSvgInfo] = useState<string>('—');

  useEffect(() => {
    if (!ref.current) return;

    let paper: dia.Paper | null = null;
    let graph: dia.Graph | null = null;

    try {
      // 핵심: 두 번째 인자(options)로 cellNamespace 지정
      graph = new dia.Graph({}, { cellNamespace: shapes as any });

      paper = new dia.Paper({
        el: ref.current,
        model: graph,
        width: ref.current.clientWidth || 800,
        height,
        gridSize: 10,
        drawGrid: true,
        async: false, // 디버깅 위해 동기 모드
        cellViewNamespace: shapes as any,
        sorting: dia.Paper.sorting.APPROX,
        background: { color: 'var(--paper-bg, #fff)' },
      });

      // 반응형 리사이즈
      const ro = new ResizeObserver(() => {
        if (ref.current && paper) {
          const w = ref.current.clientWidth || 800;
          paper.setDimensions(w, height);
        }
      });
      ro.observe(ref.current);

      // 데이터 주입
      try {
        if (data && (data.cells || data.elements || Array.isArray(data))) {
          graph.fromJSON(data);
          // fromJSON 성공 직후 (graph.fromJSON(data) 다음에 추가)
          try {
            // 요소(사각형 등)와 링크 모두 "눈에 띄는" 스타일로 강제 보정
            graph.getElements().forEach((el) => {
              el.attr({
                'body/fill': el.attr('body/fill') ?? '#60a5fa',
                'body/stroke': '#111',
                'body/strokeWidth': 2,
                'label/fill': '#111',
                'label/fontSize': 14,
              });
            });
            graph.getLinks().forEach((lnk) => {
              lnk.attr({
                'line/stroke': '#111',
                'line/strokeWidth': 2,
                'line/targetMarker': { 'type': 'path', 'd': 'M 10 -5 0 0 10 5 z', 'fill': '#111' }
              });
            });

            // 뷰포트 밖이면 보이도록 맞추기
            if (typeof (paper as any).fitToContent === 'function') {
              (paper as any).fitToContent({ padding: 20, allowNewOrigin: 'any' });
            } else if (typeof (paper as any).scaleContentToFit === 'function') {
              (paper as any).scaleContentToFit({ padding: 20 });
            }

            // SVG 아웃라인을 강제로 그려 "존재" 시각화
            const svgEl: SVGSVGElement | null = (paper as any).svg || ref.current!.querySelector('svg');
            if (svgEl) {
              (svgEl as any).style.outline = '2px dashed #f59e0b';
              (svgEl as any).style.background = '#fff';
              (svgEl as any).style.overflow = 'visible';
            }
          } catch {}
        } else {
          // 데이터가 애매하면 샘플 셀
          const rect = new (shapes as any).standard.Rectangle({
            position: { x: 20, y: 20 },
            size: { width: 140, height: 44 },
            attrs: {
              label: { text: 'Empty data' },
              body: { fill: '#fecaca', stroke: '#b91c1c', strokeWidth: 2 }
            },
          });
          graph.addCell(rect);
        }
      } catch (e: any) {
        console.error('JointJS fromJSON error:', e);
        setErrorMsg(`fromJSON error: ${e?.message || String(e)}`);
      }

      // 뷰포트 밖으로 밀려난 경우 대비: 콘텐츠에 맞춰 보기 보정
      try {
        // @ts-ignore 일부 환경에서만 존재
        if (typeof (paper as any).fitToContent === 'function') {
          (paper as any).fitToContent({ padding: 20, allowNewOrigin: 'any' });
        } else if (typeof (paper as any).scaleContentToFit === 'function') {
          (paper as any).scaleContentToFit({ padding: 20 });
        }
      } catch (e) {
        // 옵션 메서드 미존재 시 무시
      }

      // SVG 가시성/요소 카운트 체크
      const updateSvgInfo = () => {
        const svgEl: SVGSVGElement | null = (paper as any).svg || ref.current!.querySelector('svg');
        if (svgEl) {
          // 디버그: 보더로 SVG 아웃라인 강제
          (svgEl as any).style.outline = '2px dashed #9ca3af';

          const rects = svgEl.querySelectorAll('rect').length;
          const paths = svgEl.querySelectorAll('path').length;
          const texts = svgEl.querySelectorAll('text').length;
          const all = svgEl.querySelectorAll('*').length;
          setSvgInfo(`svg all:${all} rect:${rects} path:${paths} text:${texts}`);
        } else {
          setSvgInfo('no <svg>');
        }
      };

      // 최초 업데이트
      setCellCount(graph.getCells().length);
      updateSvgInfo();

      // 혹시 요소가 안 그려졌다면(=svg 내부 비어있다면) 샘플 하나 강제 추가
      if (graph.getCells().length > 0) {
        const svgEl: SVGSVGElement | null = (paper as any).svg || ref.current!.querySelector('svg');
        if (!svgEl || svgEl.querySelectorAll('*').length === 0) {
          const rect = new (shapes as any).standard.Rectangle({
            position: { x: 24, y: 24 },
            size: { width: 160, height: 52 },
            attrs: {
              label: { text: 'Force Draw' },
              body: { fill: '#60a5fa', stroke: '#111', strokeWidth: 2 }
            },
          });
          graph.addCell(rect);
          setCellCount(graph.getCells().length);
          // 다시 보정
          try {
            // @ts-ignore
            if (typeof (paper as any).fitToContent === 'function') {
              (paper as any).fitToContent({ padding: 20, allowNewOrigin: 'any' });
            }
          } catch {}
          updateSvgInfo();
        }
      }

      return () => {
        ro.disconnect();
        paper?.remove();
        graph?.clear();
      };
    } catch (err: any) {
      console.error('JointJSRenderer init error:', err);
      setErrorMsg(`init error: ${err?.message || String(err)}`);
    }
  }, [data, height]);

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={ref}
        style={{
          width: '100%',
          minHeight: height,
          height,
          overflow: 'auto',
          background: 'var(--paper-bg, #fff)',
          borderRadius: 8,
        }}
      />
      <div style={{ position: 'absolute', right: 8, bottom: 8, fontSize: 12, opacity: 0.85, background: '#00000014', padding: '4px 8px', borderRadius: 6, lineHeight: 1.2 }}>
        cells: {cellCount >= 0 ? cellCount : '—'} {errorMsg ? `| ${errorMsg}` : ''}<br/>
        {svgInfo}
      </div>
    </div>
  );
};

export default JointJSRenderer;
