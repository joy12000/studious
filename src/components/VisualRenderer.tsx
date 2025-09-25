// src/components/VisualRenderer.tsx
import React from 'react';
import ShadowHost from './ShadowHost';
import { InlineMath, BlockMath } from 'react-katex';
import appCss from '../index.css?raw';

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
  box: 'div', p: 'p', span: 'span', img: 'img', div: 'div',
  h1: 'h1', h2: 'h2', h3: 'h3', ul: 'ul', li: 'li', strong: 'strong',
  text: 'span' // 'text' 타입을 'span'으로 매핑
};

function ensureVisibleDefaults(type: string, props: Record<string, any>) {
  const p = { ...props };
  if (SVG_TAGS.has(type)) {
    if (p.stroke == null && p.fill == null) {
      p.stroke = 'currentColor';
      p.fill = 'none';
    }
    if (p.strokeWidth == null && (type === 'path' || type === 'line' || type === 'polyline' || type === 'polygon')) {
      p.strokeWidth = 2;
    }
  }
  return p;
}

const renderContentWithLatex = (text: string) => {
  if (!text) return null;
  const regex = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (part.startsWith('$$') && part.endsWith('$$')) {
      return <BlockMath key={i}>{part.slice(2, -2)}</BlockMath>;
    }
    if (part.startsWith('$') && part.endsWith('$')) {
      return <InlineMath key={i}>{part.slice(1, -1)}</InlineMath>;
    }
    return part;
  });
};

const VisualRenderer: React.FC<Props> = ({ config }) => {
  if (!config) return null;

  const renderNode = (node?: NodeConfig): React.ReactNode => {
    if (!node) return null;

    const { type, props = {}, children: structuralChildren = [] } = node;
    
    // ✅ [수정] props에서 content와 children을 모두 확인하도록 변경
    const { content, innerHTML, style, className, children: propsChildren, ...rest0 } = props;
    
    const isSvg = SVG_TAGS.has(type);
    const componentType = isSvg ? type : (HTML_TAG_MAP[type] ?? 'div');

    const rest = ensureVisibleDefaults(type, rest0);
    const styleObj = (typeof style === 'object' && style) ? style : undefined;

    // ✅ [수정] 렌더링할 자식 요소를 결정하는 로직 강화
    let finalChildren;
    const textualContent = typeof propsChildren === 'string' ? propsChildren : content;

    if (typeof textualContent === 'string') {
      // 텍스트 내용이 props.children 또는 props.content에 있는 경우
      finalChildren = renderContentWithLatex(textualContent);
    } else if (Array.isArray(structuralChildren) && structuralChildren.length > 0) {
      // 중첩된 노드가 최상위 children 배열에 있는 경우
      finalChildren = structuralChildren.map((c, i) => <React.Fragment key={i}>{renderNode(c)}</React.Fragment>);
    }

    if (innerHTML) {
      return React.createElement(componentType, {
        ...rest, style: styleObj, className,
        dangerouslySetInnerHTML: { __html: String(innerHTML) }
      });
    }

    return React.createElement(componentType, { ...rest, style: styleObj, className }, finalChildren);
  };

  return (
    <div className="visual-root">
      <ShadowHost styleText={appCss}>
        <div className="p-1 prose dark:prose-invert max-w-none">{renderNode(config)}</div>
      </ShadowHost>
    </div>
  );
};

export default VisualRenderer;