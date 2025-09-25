import React from 'react';
import ShadowHost from './ShadowHost';
import { InlineMath, BlockMath } from 'react-katex';
// ✅ 1. 프로젝트의 모든 CSS를 텍스트로 가져옵니다. (Vite의 ?raw 기능)
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

// ✅ 2. AI가 생성하는 모든 태그 타입을 명시합니다.
const HTML_TAG_MAP: Record<string, string> = {
  box: 'div', p: 'p', span: 'span', img: 'img', div: 'div',
  h1: 'h1', h2: 'h2', h3: 'h3', ul: 'ul', li: 'li', strong: 'strong',
  text: 'span' // 'text' 타입을 'span'으로 매핑
};

/** 외부 CSS 없이도 보이도록 SVG 기본값 보정 */
function ensureVisibleDefaults(type: string, props: Record<string, any>) {
  const p = { ...props };
  if (SVG_TAGS.has(type)) {
    if (p.stroke == null && p.fill == null) {
      p.stroke = 'currentColor'; // Tailwind의 color를 따르도록 변경
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

    // ✅ 3. className을 props에서 올바르게 추출합니다.
    const { type, props = {}, children = [] } = node;
    const { content, innerHTML, style, className, ...rest0 } = props;
    
    const isSvg = SVG_TAGS.has(type);
    const componentType = isSvg ? type : (HTML_TAG_MAP[type] ?? 'div');

    const rest = ensureVisibleDefaults(type, rest0);
    const styleObj = (typeof style === 'object' && style) ? style : undefined;

    const kids = (children as NodeConfig[]).map((c, i) => <React.Fragment key={i}>{renderNode(c)}</React.Fragment>);
    const renderedContent = typeof content === 'string' ? renderContentWithLatex(content) : content;

    // ✅ 4. 모든 요소에 className과 style을 전달하도록 수정합니다.
    return React.createElement(componentType, { ...rest, style: styleObj, className }, renderedContent, ...kids);
  };

  // ✅ 5. 최종 렌더링 시, ShadowHost로 전체를 감싸고 Tailwind CSS를 주입합니다.
  // 이렇게 하면 SVG와 HTML 모두 Tailwind 클래스의 영향을 받게 됩니다.
  return (
    <div className="visual-root">
      <ShadowHost styleText={appCss}>
        <div className="p-1 prose dark:prose-invert max-w-none">{renderNode(config)}</div>
      </ShadowHost>
    </div>
  );
};

export default VisualRenderer;