// src/components/JointJSRenderer.tsx
import React, { useEffect, useRef, useState } from 'react';
// 환경에 따라 named import가 안 먹으면 주석의 대안을 사용하세요.
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
      // ✅ 핵심 수정: cellNamespace는 두 번째 인자(options)로!
      graph = new dia.Graph({}, { cellNamespace: shapes as any });

      paper = new dia.Paper({
        el: ref.current,
        model: graph,
        width: ref.current.clientWidth || 800,
        height,
        gridSize: 10,
        drawGrid: true,
        async: true,
        // 뷰 네임스페이스도 shapes로
        cellViewNamespace: shapes as any,
        sorting: dia.Paper.sorting.APPROX,
        background: { color: 'var(--paper-bg, #fff)' },
      });

      const ro = new ResizeObserver(() => {
        if (ref.current && paper) {
          const w = ref.current.clientWidth || 800;
          paper.setDimensions(w, height);
        }
      });
      ro.observe(ref.current);

      try {
        if (data && (data.cells || data.elements || Array.isArray(data))) {
          graph.fromJSON(data);
        } else {
          // 데이터가 비어있으면 샘플 하나 그려 "보임" 자체 확인
          const rect = new (shapes as any).standard.Rectangle({
            position: { x: 20, y: 20 },
            size: { width: 140, height: 44 },
            attrs: { label: { text: 'Empty data' }, body: { fill: '#fecaca', stroke: '#b91c1c' } },
          });
          graph.addCell(rect);
        }
      } catch (e: any) {
        console.error('JointJS fromJSON error:', e);
        setErrorMsg(`fromJSON error: ${e?.message || String(e)}`);
      }

      setCellCount(graph.getCells().length);

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
