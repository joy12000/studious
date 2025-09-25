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
  box: 'div', p: 'p', span: 'span', img: 'img', div: 'div'
};

const VisualRenderer: React.FC<Props> = ({ config }) => {
  if (!config) return null;

  const renderNode = (node?: NodeConfig): React.ReactNode => {
    if (!node) return null;

    const type = node.type;
    const isSvg = SVG_TAGS.has(type);
    const componentType = isSvg ? type : (HTML_TAG_MAP[type] ?? 'div');

    const { children = [], ...rawProps } = node.props ?? {};
    const { content, innerHTML, style, ...rest } = rawProps;
    const styleObj = (typeof style === 'object' && style) ? style : undefined;

    // 루트 svg: 크기/표시 강제
    if (isSvg && type === 'svg') {
      (rest as any).xmlns = (rest as any).xmlns || 'http://www.w3.org/2000/svg';
      if ((rest as any).width == null && (rest as any).height == null) {
        (rest as any).width = 480;
        (rest as any).height = 280;
      }
      const base: React.CSSProperties = {
        display: 'block',
        background: '#ffffff',
        outline: '2px dashed #9ca3af',
        overflow: 'visible',
        isolation: 'isolate' // 상위 blend 영향 차단
      };
      (rest as any).style = { ...base, ...(styleObj || {}) };

      const injectedStyle = (
        <style key="__force_style__">{`
/* === 강제 가시화 규칙 (전역 CSS 덮어쓰기) === */
svg { display:block !important; }
svg, svg * { visibility: visible !important; opacity: 1 !important; filter: none !important; mix-blend-mode: normal !important; }
svg text { fill: #111 !important; font-size: 14px; }
svg rect, svg circle, svg ellipse, svg path, svg polyline, svg polygon, svg line {
  stroke: #111 !important;
  stroke-width: 2 !important;
  fill: none !important; /* 채우기 때문에 안 보이는 케이스 방지 */
}
/* 뷰포트 밖 잘림 방지 */
svg { overflow: visible !important; }
        `}</style>
      );

      const kids = (children as NodeConfig[]).map((c, i) => <React.Fragment key={i}>{renderNode(c)}</React.Fragment>);
      return React.createElement(componentType, rest, injectedStyle, ...kids);
    }

    // SVG 텍스트: content는 텍스트 노드로
    if (isSvg && type === 'text') {
      const kids = (children as NodeConfig[]).map((c, i) => <React.Fragment key={i}>{renderNode(c)}</React.Fragment>);
      return React.createElement(componentType, { ...rest, style: styleObj }, content ?? null, ...kids);
    }

    // HTML 태그에서만 innerHTML 허용
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
