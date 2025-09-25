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

function ensureVisibleDefaults(type: string, props: Record<string, any>) {
  const p = { ...props };
  if (SVG_TAGS.has(type)) {
    // 기본 가시성 확보
    if (p.stroke == null && p.fill == null) {
      p.stroke = '#111';
      p.fill = 'none';
    }
    if (
      p.strokeWidth == null &&
      (type === 'path' || type === 'line' || type === 'polyline' || type === 'polygon')
    ) {
      p.strokeWidth = 1.5;
    }
  }
  return p;
}

const VisualRenderer: React.FC<Props> = ({ config }) => {
  if (!config) return null;

  const renderNode = (node: NodeConfig | undefined): React.ReactNode => {
    if (!node) return null;

    const type = node.type;
    const isSvg = SVG_TAGS.has(type);
    const componentType = isSvg ? type : (HTML_TAG_MAP[type] ?? 'div');

    const { children = [], ...rawProps } = node.props ?? {};
    const { content, innerHTML, style, ...rest0 } = rawProps;
    const rest = ensureVisibleDefaults(type, rest0);
    const styleObj = (typeof style === 'object' && style) ? style : undefined;

    // 루트 svg: 크기와 표시 강제
    if (isSvg && type === 'svg') {
      (rest as any).xmlns = (rest as any).xmlns || 'http://www.w3.org/2000/svg';
      if ((rest as any).width == null && (rest as any).height == null) {
        (rest as any).width = 400;
        (rest as any).height = 240;
      }
      // 강제 표시 스타일
      const base: React.CSSProperties = {
        display: 'block',
        background: '#fff',
        outline: '2px dashed #9ca3af',
        overflow: 'visible',
      };
      (rest as any).style = { ...base, ...(styleObj || {}) };

      // 자식 앞에 <style> 주입: 전역/부모 CSS에 의해 가려지는 것을 무시
      const injectedStyle = React.createElement(
        'style',
        { key: '__force_style__' as any },
        `
/* 강제 가시화 */
svg, svg * { visibility: visible !important; opacity: 1 !important; }
text { fill: #111 !important; }
[stroke="none"][fill="none"] { stroke: #111 !important; }
/* 선이 너무 얇으면 안 보이니 최소 두께 */
line, path, polyline, polygon { stroke-width: 1.5 !important; }
/* reset로 display가 바뀌면 복구 */
svg { display: block !important; }
/* 텍스트가 축소되며 흐리지 않게 */
* { vector-effect: non-scaling-stroke; }
        `.trim()
      );

      const renderedChildren = (children as NodeConfig[]).map((c, idx) => (
        <React.Fragment key={idx}>{renderNode(c)}</React.Fragment>
      ));

      return React.createElement(componentType, rest, injectedStyle, ...renderedChildren);
    }

    // SVG 텍스트: content를 텍스트 노드로
    if (isSvg && type === 'text') {
      const renderedChildren = (children as NodeConfig[]).map((c, idx) => (
        <React.Fragment key={idx}>{renderNode(c)}</React.Fragment>
      ));
      return React.createElement(componentType, { ...rest, style: styleObj }, content ?? null, ...renderedChildren);
    }

    // HTML 태그에서만 innerHTML 허용
    if (!isSvg && innerHTML) {
      return React.createElement(componentType, {
        ...rest,
        style: styleObj,
        dangerouslySetInnerHTML: { __html: String(innerHTML) }
      });
    }

    const renderedChildren = (children as NodeConfig[]).map((c, idx) => (
      <React.Fragment key={idx}>{renderNode(c)}</React.Fragment>
    ));

    return React.createElement(componentType, { ...rest, style: styleObj }, content ?? null, ...renderedChildren);
  };

  return (
    <div className="visual-root" style={{ position: 'relative' }}>
      {renderNode(config)}
    </div>
  );
};

export default VisualRenderer;
