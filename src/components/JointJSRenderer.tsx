// src/components/JointJSRenderer.tsx
import React, { useEffect, useRef, useState } from 'react';
// 권장: named import (환경에 따라 아래 주석처럼 바꿔보세요)
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

  useEffect(() => {
    if (!ref.current) return;

    let paper: dia.Paper | null = null;
    let graph: dia.Graph | null = null;

    try {
      // JointJS 타입 문자열("standard.Rectangle" 등)을 인식하려면 네임스페이스 지정이 필요
      graph = new dia.Graph({ cellNamespace: shapes as any });

      paper = new dia.Paper({
        el: ref.current,
        model: graph,
        width: ref.current.clientWidth || 800,
        height,
        gridSize: 10,
        drawGrid: true,
        async: true,
        cellViewNamespace: shapes as any, // 뷰 네임스페이스도 지정
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
      if (data) {
        try {
          if (data.cells || data.elements || Array.isArray(data)) {
            graph.fromJSON(data);
          } else {
            // 구조가 애매하면 "렌더 파이프라인은 정상"임을 확인하기 위한 샘플 셀 삽입
            const rect = new (shapes as any).standard.Rectangle({
              position: { x: 20, y: 20 },
              size: { width: 140, height: 44 },
              attrs: { label: { text: 'No cells in JSON' }, body: { fill: '#fde68a', stroke: '#111' } },
            });
            graph.addCell(rect);
          }
        } catch (e: any) {
          console.error('JointJS fromJSON error:', e);
          setErrorMsg(`fromJSON error: ${e?.message || String(e)}`);
        }
      } else {
        // data가 완전 비어있으면 샘플 셀 하나 그려서 "보임" 자체 확인
        const rect = new (shapes as any).standard.Rectangle({
          position: { x: 20, y: 20 },
          size: { width: 140, height: 44 },
          attrs: { label: { text: 'Empty data' }, body: { fill: '#fecaca', stroke: '#b91c1c' } },
        });
        graph.addCell(rect);
      }

      setCellCount(graph.getCells().length);

      // cleanup
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
      <div style={{ position: 'absolute', right: 8, bottom: 8, fontSize: 12, opacity: 0.8, background: '#0000000d', padding: '2px 6px', borderRadius: 6 }}>
        cells: {cellCount >= 0 ? cellCount : '—'} {errorMsg ? `| ${errorMsg}` : ''}
      </div>
    </div>
  );
};

export default JointJSRenderer;
