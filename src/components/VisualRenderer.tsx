// src/components/VisualRenderer.tsx
import React from 'react';

type NodeConfig = {
  type: string;
  props?: Record<string, any>;
  children?: NodeConfig[];
};

interface Props {
  config?: NodeConfig;
}

const SVG_TAGS = new Set([
  'svg','g','defs','marker','path','rect','circle','ellipse','line','polyline','polygon','text',
  'linearGradient','radialGradient','stop','pattern','clipPath','mask','foreignObject','style'
]);

const HTML_TAG_MAP: Record<string, string> = {
  box: 'div',
  p: 'p',
  span: 'span',
  img: 'img',
  div: 'div'
};

const VisualRenderer: React.FC<Props> = ({ config }) => {
  if (!config) return null;

  // 디버그: 콘솔에 config 찍기 (개발중에만 유용)
  if (typeof window !== 'undefined' && (window as any).__DEV__) {
    console.debug('VisualRenderer config:', config);
  }

  const type = config.type;
  const isSvg = SVG_TAGS.has(type);
  const componentType = isSvg ? type : (HTML_TAG_MAP[type] ?? 'div');

  const { children = [], ...rawProps } = config.props ?? {};
  const { content, innerHTML, style, ...rest } = rawProps;

  // SVG 루트라면 xmlns 보장
  const finalProps: any = { ...rest };
  if (isSvg && type === 'svg') {
    finalProps.xmlns = finalProps.xmlns || 'http://www.w3.org/2000/svg';
    // viewBox나 width/height 숫자/문자형 체크
    if (finalProps.viewBox && typeof finalProps.viewBox !== 'string') {
      finalProps.viewBox = String(finalProps.viewBox);
    }
  }

  const styleObj = (typeof style === 'object' && style) ? style : undefined;

  const childNodes = (children as NodeConfig[]).map((c, idx) => (
    <VisualRenderer key={idx} config={c} />
  ));

  if (isSvg && type === 'text') {
    // SVG text: content는 텍스트 노드로
    return React.createElement(componentType, { ...finalProps, style: styleObj }, content ?? null, childNodes);
  }

  if (innerHTML && !isSvg) {
    return React.createElement(componentType, { ...finalProps, style: styleObj, dangerouslySetInnerHTML: { __html: String(innerHTML) } });
  }

  return React.createElement(componentType, { ...finalProps, style: styleObj }, content ?? null, childNodes);
};

export default VisualRenderer;
