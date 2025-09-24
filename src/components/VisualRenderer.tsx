import React from 'react';

// SVG 요소를 위한 네임스페이스
const SVG_NS = "http://www.w3.org/2000/svg";

const VisualRenderer = ({ config }) => {
  if (!config) return null;

  // 렌더링할 요소의 타입 결정 (SVG 태그인지 일반 HTML 태그인지)
  const isSvg = ['svg', 'rect', 'circle', 'path', 'defs', 'marker', 'polygon', 'ellipse', 'g', 'linearGradient', 'stop', 'text'].includes(config.type);
  
  // React.createElement를 사용하여 동적으로 요소 생성
  // isSvg 값에 따라 적절한 네임스페이스를 가진 요소를 만듭니다.
  const componentType = isSvg ? config.type : (config.type === 'box' ? 'div' : 'p');
  
  const { content, ...restProps } = config.props || {};

  const children = config.children && config.children.map((child, index) => (
    <VisualRenderer key={index} config={child} />
  ));

  if (isSvg) {
    // SVG 요소의 경우, 텍스트 자식은 content prop으로 처리
    const svgChildren = content ? [<tspan key="content">{content}</tspan>, ...children] : children;
    return React.createElement(componentType, restProps, ...svgChildren);
  } else {
    // HTML 요소의 경우, 텍스트와 자식 요소를 모두 렌더링
    return React.createElement(componentType, restProps, content, children);
  }
};

export default VisualRenderer;