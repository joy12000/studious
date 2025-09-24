import React, { useEffect, useRef } from 'react';
import * as joint from '@joint/core';

interface JointJSRendererProps {
  data: any;
}

const JointJSRenderer: React.FC<JointJSRendererProps> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      const graph = new joint.dia.Graph();
      const paper = new joint.dia.Paper({
        el: containerRef.current,
        model: graph,
        width: containerRef.current.offsetWidth,
        height: 300,
        gridSize: 10,
        drawGrid: true,
        background: {
          color: '#f8f8f8',
        },
      });

      if (data && data.cells) {
        graph.fromJSON(data);
      }

      return () => {
        paper.remove();
      };
    }
  }, [data]);

  return <div ref={containerRef} style={{ width: '100%', height: '300px' }}></div>;
};

export default JointJSRenderer;