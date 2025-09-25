// src/components/JointJSRenderer.tsx
import React, { useEffect, useRef } from 'react';
import * as joint from '@joint/core';

interface JointJSRendererProps {
  data: any;
  height?: number;
}

const JointJSRenderer: React.FC<JointJSRendererProps> = ({ data, height = 360 }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const graph = new joint.dia.Graph({ cellNamespace: joint.shapes });
    const paper = new joint.dia.Paper({
      el: containerRef.current,
      model: graph,
      width: containerRef.current.clientWidth || 800,
      height,
      gridSize: 10,
      drawGrid: true,
      async: true,
      sorting: joint.dia.Paper.sorting.APPROX,
      background: { color: 'var(--paper-bg, transparent)' }
    });

    // 반응형 리사이즈
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w && paper.options.width !== w) paper.setDimensions(w, height);
      }
    });
    ro.observe(containerRef.current);

    // 데이터 주입
    try {
      if (data && data.cells) {
        graph.fromJSON(data);
      }
    } catch (e) {
      console.error('JointJS fromJSON error:', e);
    }

    return () => {
      ro.disconnect();
      paper.remove();
      graph.clear();
    };
  }, [data, height]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height,
        minHeight: height,
        overflow: 'auto',
      }}
    />
  );
};

export default JointJSRenderer;
