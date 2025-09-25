// src/components/VisualRenderer.tsx
import React from 'react';

// SVG 요소를 위한 네임스페이스
const SVG_NS = "http://www.w3.org/2000/svg";

const VisualRenderer = ({ config }) => {
  if (!config) return null;

  // 렌더링할 요소의 타입 결정
  const isSvg = ['svg', 'rect', 'circle', 'path', 'defs', 'marker', 'polygon', 'ellipse', 'g', 'linearGradient', 'stop', 'text'].includes(config.type);
  
  // React.createElement를 사용하여 동적으로 요소 생성
  const componentType = isSvg 
    ? config.type 
    : (config.type === 'box' ? 'div' : 'p');
  
  const { content, children, ...restProps } = config.props || {};

  // 자식 요소들을 재귀적으로 렌더링
  const childComponents = children && children.map((child, index) => (
    <VisualRenderer key={index} config={child} />
  ));

  // SVG 텍스트는 <text> 태그 내부에 직접 렌더링
  if (isSvg && config.type === 'text') {
    return React.createElement(componentType, restProps, content, childComponents);
  }
  
  // 일반 HTML 요소
  return React.createElement(componentType, restProps, content, childComponents);
};

export default VisualRenderer;