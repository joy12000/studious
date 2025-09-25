import React from 'react';
import ShadowHost from './ShadowHost';

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
  box: 'div', p: 'p', span: 'span', img: 'img', div: 'div'
};

/** 외부 CSS 없이도 보이도록 기본값 보정 */
function ensureVisibleDefaults(type: string, props: Record<string, any>) {
  const p = { ...props };
  if (SVG_TAGS.has(type)) {
    if (p.stroke == null && p.fill == null) {
      p.stroke = '#111';
      p.fill = 'none';
    }
    if (p.strokeWidth == null && (type === 'path' || type === 'line' || type === 'polyline' || type === 'polygon')) {
      p.strokeWidth = 2;
    }
  }
  return p;
}

const VisualRenderer: React.FC<Props> = ({ config }) => {
  if (!config) return null;

  // Shadow DOM 안에서만 적용될 리셋/기본 스타일
  const shadowCSS = `
/* 외부(페이지 전역) CSS를 차단하고 기본값으로 복구 */
:host { all: initial; }
svg { display:block; overflow:visible; background:#fff; }
/* SVG 내부 기본값 (외부 !important에 영향 안 받음) */
svg, svg * { visibility: visible; opacity: 1; }
text { fill:#111; font-size:14px; }
line, path, polyline, polygon { stroke-width:2; }
`;

  const renderNode = (node?: NodeConfig): React.ReactNode => {
    if (!node) return null;

    const type = node.type;
    const isSvg = SVG_TAGS.has(type);
    const componentType = isSvg ? type : (HTML_TAG_MAP[type] ?? 'div');

    const { children = [], ...rawProps } = node.props ?? {};
    const { content, innerHTML, style, ...rest0 } = rawProps;
    const rest = ensureVisibleDefaults(type, rest0);
    const styleObj = (typeof style === 'object' && style) ? style : undefined;

    if (isSvg && type === 'svg') {
      (rest as any).xmlns = (rest as any).xmlns || 'http://www.w3.org/2000/svg';
      if ((rest as any).width == null && (rest as any).height == null) {
        (rest as any).width = 480; (rest as any).height = 280;
      }
      const base: React.CSSProperties = { outline: '2px dashed #9ca3af' };
      (rest as any).style = { ...(styleObj || {}), ...base };

      const kids = (children as NodeConfig[]).map((c, i) => <React.Fragment key={i}>{renderNode(c)}</React.Fragment>);

      // 🔒 Shadow DOM으로 격리해서 렌더
      return (
        <ShadowHost styleText={shadowCSS}>
          {React.createElement(componentType, rest, ...kids)}
        </ShadowHost>
      );
    }

    if (isSvg && type === 'text') {
      const kids = (children as NodeConfig[]).map((c, i) => <React.Fragment key={i}>{renderNode(c)}</React.Fragment>);
      return React.createElement(componentType, { ...rest, style: styleObj }, content ?? null, ...kids);
    }

    if (!isSvg && innerHTML) {
      return React.createElement(componentType, {
        ...rest,
        style: styleObj,
        dangerouslySetInnerHTML: { __html: String(innerHTML) }
      });
    }

    const kids = (children as NodeConfig[]).map((c, i) => <React.Fragment key={i}>{renderNode(c)}</React.Fragment>);
    return React.createElement(componentType, { ...rest, style: styleObj }, content ?? null, ...kids);
  };

  return <div className="visual-root">{renderNode(config)}</div>;
};

export default VisualRenderer;
