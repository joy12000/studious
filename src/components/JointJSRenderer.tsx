// src/components/JointJSRenderer.tsx
import React, { useEffect, useRef } from 'react';
import { dia, shapes } from '@joint/core'; // 권장 임포트 방식

interface Props {
  data?: any;
  height?: number;
}

const JointJSRenderer: React.FC<Props> = ({ data, height = 360 }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    // Graph: shapes 네임스페이스를 명시하여 fromJSON 시 타입 해석 보장
    const graph = new dia.Graph({ cellNamespace: shapes as any });

    const paper = new dia.Paper({
      el: ref.current,
      model: graph,
      width: ref.current.clientWidth || 800,
      height,
      gridSize: 10,
      drawGrid: true,
      async: true,
      // 뷰 네임스페이스도 명시
      cellViewNamespace: shapes as any,
      // optional: background: { color: '#fff' }
    });

    // 반응형: 컨테이너 크기 변경 시 Paper 크기도 조정
    const ro = new ResizeObserver(() => {
      if (ref.current) {
        const w = ref.current.clientWidth || 800;
        paper.setDimensions(w, height);
      }
    });
    ro.observe(ref.current);

    try {
      if (data && (data.cells || data.length || data.elements)) {
        // fromJSON expects graph JSON; ensure we pass correct shape
        graph.fromJSON(data);
      } else {
        // 만약 data가 비어있다면 간단한 테스트 셀 삽입(디버그 목적)
        // graph.addCell(new shapes.standard.Rectangle({ position: { x: 20, y: 20 }, size: { width: 120, height: 40 }, attrs: { body: { fill: '#60a5fa' }, label: { text: 'Sample' } } }));
      }
    } catch (err) {
      // 콘솔에 에러 찍기 (브라우저 개발자도구 확인)
      console.error('JointJSRenderer: graph.fromJSON error', err);
    }

    return () => {
      ro.disconnect();
      paper.remove();
      graph.clear();
    };
  }, [data, height]);

  // 만약 data가 비어있거나 구조가 이상하면 사용자에게 표시
  if (!data) {
    return (
      <div style={{ border: '1px dashed #999', padding: 8, borderRadius: 6, minHeight: height }}>
        <strong>JointJS:</strong> 렌더할 데이터가 없습니다.
      </div>
    );
  }

  return <div ref={ref} style={{ width: '100%', minHeight: height, height }} />;
};

export default JointJSRenderer;
