// src/components/VisualRenderer.tsx
import React from 'react';
import ShadowHost from './ShadowHost';
import { InlineMath, BlockMath } from 'react-katex';
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from './ui/card';

// 변경: lucide-react를 와일드카드로 임포트해 런타임에 검색하도록 함
import * as LucideIcons from 'lucide-react';
import appCss from '../index.css?raw';

// --- Type Definitions ---
type NodeConfig = {
  type: string;
  props?: Record<string, any>;
  children?: NodeConfig[];
  // 내부 플래그(예: 상위에서 JSON 파싱 실패 전달 시)
  __parseError?: boolean;
};

interface Props {
  config?: NodeConfig;
  // 옵션: 오류가 나면 숨기기 여부 (기본 true)
  hideOnError?: boolean;
}

// --- Helpers ---
const toPascalCase = (s?: string) => {
  if (!s) return '';
  return s
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join('');
};

const unicodeToLatex = (text: string): string => {
  const replacements: { [key: string]: string } = {
    '²': '^2', '³': '^3', '¹': '^1', '⁴': '^4', '⁵': '^5', '⁶': '^6', '⁷': '^7', '⁸': '^8', '⁹': '^9', '⁰': '^0',
    '₀': '_0', '₁': '_1', '₂': '_2', '₃': '_3', '₄': '_4', '₅': '_5', '₆': '_6', '₇': '_7', '₈': '_8', '₉': '_9',
  };
  return Object.entries(replacements).reduce((acc, [char, latex]) => acc.replace(new RegExp(char, 'g'), latex), text);
};

const renderContentWithLatex = (text: string) => {
  if (!text) return null;
  const regex = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;
  const parts = text.split(regex);
  return parts.map((part, i) => {
    if (part.startsWith('$$') && part.endsWith('$$')) {
      const latexContent = unicodeToLatex(part.slice(2, -2));
      return <BlockMath key={i} strict={false}>{latexContent}</BlockMath>;
    }
    if (part.startsWith('$') && part.endsWith('$')) {
      const latexContent = unicodeToLatex(part.slice(1, -1));
      return <InlineMath key={i} strict={false}>{latexContent}</InlineMath>;
    }
    return part;
  });
};

// SVG tag set
const SVG_TAGS = new Set([
  'svg','g','defs','marker','path','rect','circle','ellipse','line','polyline','polygon','text',
  'linearGradient','radialGradient','stop','pattern','clipPath','mask','foreignObject','style'
]);

const HTML_TAG_MAP: Record<string, string> = {
  container: 'div', box: 'div', p: 'p', span: 'span', img: 'img', div: 'div',
  h1: 'h1', h2: 'h2', h3: 'h3', ul: 'ul', li: 'li', strong: 'strong',
  text: 'span'
};

const COMPONENT_MAP: Record<string, React.ComponentType<any>> = {
  card: Card,
  'card-header': CardHeader,
  'card-content': CardContent,
  'card-title': CardTitle,
  'card-description': CardDescription,
  'card-footer': CardFooter,
  // icon은 런타임에 처리
  icon: (props: any) => <span {...props} />
};

function ensureVisibleDefaults(type: string, props: Record<string, any>) {
  const p = { ...props };
  if (SVG_TAGS.has(type)) {
    if (p.stroke == null && p.fill == null) p.stroke = 'currentColor';
    if (p.strokeWidth == null && ['path', 'line', 'polyline', 'polygon'].includes(type)) p.strokeWidth = 2;
  }
  return p;
}

/* --- Lucide icon 런타임 검색 컴포넌트 (안전하게 찾음) --- */
const LucideIcon = ({ name, ...props }: { name?: string; [k: string]: any }) => {
  const nm = (name || '').trim();
  if (!nm) return <span style={{ color: 'red' }}>[Icon?]</span>;

  const candidates = [
    nm,
    toPascalCase(nm),
    toPascalCase(nm) + 'Icon',
    nm.replace(/[-_ ]+/g, ''),
    nm.toLowerCase(),
  ];

  let IconComp: any = null;
  for (const c of candidates) {
    IconComp = (LucideIcons as any)[c];
    if (IconComp) break;
  }

  // 일부 배포본은 icons 네임스페이스로도 제공 가능
  if (!IconComp && (LucideIcons as any).icons) {
    for (const c of candidates) {
      IconComp = (LucideIcons as any).icons[c];
      if (IconComp) break;
    }
  }

  if (!IconComp) {
    console.warn(`Icon "${name}" not found in lucide-react (tried: ${candidates.join(', ')})`);
    return <span style={{ color: 'red' }}>[Icon: {name}?]</span>;
  }

  try {
    return React.createElement(IconComp, props);
  } catch (err) {
    console.error('Error rendering Lucide icon', err);
    return <span style={{ color: 'red' }}>[IconErr]</span>;
  }
};

// --- Main Component ---
const VisualRenderer: React.FC<Props> = ({ config, hideOnError = true }) => {
  // 1) 파싱 실패 플래그가 있으면 아무것도 렌더하지 않음 (상위에서 JSON.parse 실패 시 마킹하도록 활용)
  if (!config) return null;
  if ((config as any).__parseError) return null;

  // 2) 전체 렌더 단계에서 안전망: 예외 발생 시 null 반환 (UI 깨짐 방지)
  try {
    const renderNode = (node?: NodeConfig): React.ReactNode => {
      if (!node) return null;

      const { type, props = {}, children: structuralChildren = [] } = node;
      // props 분해
      const { content, innerHTML, style, className, children: propsChildren, name: iconName, ...rest0 } = props;

      // 선택: 커스텀 컴포넌트
      const CustomComponent = (COMPONENT_MAP as any)[type];
      const isSvg = SVG_TAGS.has(type);
      const componentType = CustomComponent || (isSvg ? type : (HTML_TAG_MAP[type] ?? 'div'));

      // latex 타입 지원
      if (type === 'latex') {
        const latexContent = unicodeToLatex(String(content || ''));
        return props.block
          ? <BlockMath strict={false}>{latexContent}</BlockMath>
          : <InlineMath strict={false}>{latexContent}</InlineMath>;
      }

      // 아이콘 타입 처리: name prop 또는 content/children로부터 이름 추출
      if (type === 'icon') {
        const nm =
          iconName ||
          (typeof content === 'string' ? content : '') ||
          (Array.isArray(structuralChildren) && structuralChildren[0]?.props?.name) ||
          '';
        const iconEl = <LucideIcon name={nm} />;
        return React.createElement(componentType as any, { ...rest0, style: style as any, className }, iconEl);
      }

      const rest = ensureVisibleDefaults(type, rest0);
      const styleObj = (typeof style === 'object' && style) ? style : undefined;

      // determine children
      let finalChildren: React.ReactNode = null;
      const textualContent = typeof propsChildren === 'string' ? propsChildren : content;

      if (typeof textualContent === 'string') {
        finalChildren = renderContentWithLatex(textualContent);
      } else if (Array.isArray(structuralChildren) && structuralChildren.length > 0) {
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

    // 실제 렌더
    return (
      <div className="visual-root">
        <ShadowHost styleText={appCss}>
          <div className="p-1 prose dark:prose-invert max-w-none">
            {renderNode(config)}
          </div>
        </ShadowHost>
      </div>
    );
  } catch (err) {
    // 에러 발생 시 (옵션에 따라) 아무것도 렌더하지 않음. 디버그 메시지 출력.
    console.error('VisualRenderer render error — hiding visual output', err);
    if (hideOnError) return null;
    // hideOnError=false인 경우에는 단순한 에러 메시지 노출
    return <div style={{ color: 'red' }}>Visual render error</div>;
  }
};

export default VisualRenderer;
