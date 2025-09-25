// src/components/VisualRenderer.tsx
import React from 'react';

const VisualRenderer = ({ config }: { config: any }) => {
  if (!config) return null;

  // ✅ [수정 코드] config 객체에서 props와 children을 올바르게 분리
  const { type, props = {}, children = [] } = config;
  const { content, ...restProps } = props;

  const isSvg = ['svg', 'rect', 'circle', 'path', 'defs', 'marker', 'polygon', 'ellipse', 'g', 'linearGradient', 'stop', 'text'].includes(type);
  
  const componentType = isSvg 
    ? type 
    : (type === 'box' ? 'div' : 'p');

  const childComponents = children && children.map((child: any, index: number) => (
    <VisualRenderer key={index} config={child} />
  ));

  return React.createElement(componentType, restProps, content || null, childComponents);
};

export default VisualRenderer;