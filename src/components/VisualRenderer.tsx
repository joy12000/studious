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

const ensureVisibleDefaults = (type: string, props: Record<string, any>) => {
  const p = { ...props };
  if (SVG_TAGS.has(type)) {
    if (p.stroke == null && p.fill == null) {
      p.stroke = '#111';
      p.fill = 'none';
    }
    if (p.strokeWidth == null && (type === 'path' || type === 'line' || type === 'polyline' || type === 'polygon')) {
      p.strokeWidth = 1.5;
    }
  }
  return p;
};

const VisualRenderer: React.FC<Props> = ({ config }) => {
  if (!config) return null;

  const type = config.type;
  const isSvg = SVG_TAGS.has(type);
  const componentType = isSvg ? type : (HTML_TAG_MAP[type] ?? 'div');

  const { children = [], ...rawProps } = config.props ?? {};
  const { content, innerHTML, style, ...rest0 } = rawProps;

  const rest = ensureVisibleDefaults(type, rest0);

  if (isSvg && type === 'svg') {
    (rest as any).xmlns = (rest as any).xmlns || 'http://www.w3.org/2000/svg';
    if ((rest as any).width == null && (rest as any).height == null) {
      (rest as any).width = 400;
      (rest as any).height = 240;
    }
    if ((rest as any).style == null) (rest as any).style = {};
    (rest as any).style.display = (rest as any).style.display || 'block';
  }

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
