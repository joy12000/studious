// src/components/VisualRenderer.tsx
import React from 'react';

/**
 * JSON 기반으로 HTML/SVG를 재귀 렌더링하는 단순 렌더러
 * 예시:
 * {
 *   "type": "svg",
 *   "props": { "width": 400, "height": 200 },
 *   "children": [
 *     { "type": "rect", "props": { "x": 10, "y": 10, "width": 100, "height": 80, "fill": "#60a5fa" } },
 *     { "type": "text", "props": { "x": 60, "y": 60, "textAnchor": "middle", "dominantBaseline": "middle", "content": "Hello" } }
 *   ]
 * }
 */

type NodeConfig = {
  type: string;
  props?: Record<string, any>;
  children?: NodeConfig[];
};

interface VisualRendererProps {
  config: NodeConfig;
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

const VisualRenderer: React.FC<VisualRendererProps> = ({ config }) => {
  if (!config) return null;

  const type = config.type;
  const isSvg = SVG_TAGS.has(type);

  const componentType = isSvg ? type : (HTML_TAG_MAP[type] ?? 'div');

  // props 분리
  const { children = [], ...rawProps } = config.props ?? {};

  // 'content' 키는 텍스트/innerHTML 컨텐츠로 사용
  const { content, innerHTML, style, ...rest } = rawProps;

  // style 은 객체만 허용
  const styleObj = (typeof style === 'object' && style) ? style : undefined;

  const childNodes = (children as NodeConfig[]).map((c, idx) => (
    <VisualRenderer key={idx} config={c} />
  ));

  if (isSvg && type === 'text') {
    return React.createElement(componentType, { ...rest, style: styleObj }, content ?? null, childNodes);
  }

  if (innerHTML && !isSvg) {
    return React.createElement(componentType, { ...rest, style: styleObj, dangerouslySetInnerHTML: { __html: String(innerHTML) } });
  }

  return React.createElement(componentType, { ...rest, style: styleObj }, content ?? null, childNodes);
};

export default VisualRenderer;
