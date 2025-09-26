// src/components/VisualRenderer.tsx
import React from 'react';
import ShadowHost from './ShadowHost';
import { InlineMath, BlockMath } from 'react-katex';
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from './ui/card';

// ---- 변경: lucide-react를 와일드카드로 가져와 동적으로 조회하도록 변경 ----
import * as LucideIcons from 'lucide-react';
import appCss from '../index.css?raw';

// --- Type Definitions ---
type NodeConfig = {
  type: string;
  props?: Record<string, any>;
  children?: NodeConfig[];
};

interface Props {
  config?: NodeConfig;
}

// --- Icon Component ---
// 기존: icons 객체를 직접 import 했던 방식은 버전/빌드에 따라 존재하지 않거나 런타임에서 찾기 어려움.
// 변경: name을 받아 PascalCase로 변환 후 LucideIcons[name] 으로 찾고, 없으면 폴백을 표시.
const toPascalCase = (s?: string) => {
  if (!s) return '';
  return s
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join('');
};

const LucideIcon = ({ name, ...props }: { name?: string; [k: string]: any }) => {
  const nm = (name || '').trim();
  if (!nm) return <span style={{ color: 'red' }}>[Icon?]</span>;

  // 가능한 후보 이름들: 원문, PascalCase 변환 등
  const candidates = [
    nm,
    toPascalCase(nm),
    toPascalCase(nm) + 'Icon',
    nm.replace(/[-_ ]+/g, ''),
    nm.toLowerCase(),
  ];

  // LucideIcons 내에 아이콘 컴포넌트가 있는지 검색
  let IconComp: any = null;
  for (const c of candidates) {
    IconComp = (LucideIcons as any)[c];
    if (IconComp) break;
  }

  // 일부 lucide 버전은 `icons` 네임스페이스를 export할 수 있으므로 체크
  if (!IconComp && (LucideIcons as any).icons) {
    for (const c of candidates) {
      IconComp = (LucideIcons as any).icons[c];
      if (IconComp) break;
    }
  }

  if (!IconComp) {
    console.warn(`Icon "${name}" not found in lucide-react. Tried: ${candidates.join(', ')}`);
    // 사용자에게 눈에 띄게 폴백을 보여줌 (개발/디버그 용)
    return <span style={{ color: 'red' }}>[Icon: {name}?]</span>;
  }

  // 성공적으로 찾았으면 렌더
  return React.createElement(IconComp, props);
};

// --- Component & Tag Mappings ---
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
  icon: LucideIcon, // LucideIcon을 맵에 연결
};

// --- Utility Functions ---
function ensureVisibleDefaults(type: string, props: Record<string, any>) {
  const p = { ...props };
  if (SVG_TAGS.has(type)) {
    if (p.stroke == null && p.fill == null) p.stroke = 'currentColor';
    if (p.strokeWidth == null && ['path', 'line', 'polyline', 'polygon'].includes(type)) p.strokeWidth = 2;
  }
  return p;
}

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

// --- Main Renderer Component ---
const VisualRenderer: React.FC<Props> = ({ config }) => {
  if (!config) return null;

  const renderNode = (node?: NodeConfig): React.ReactNode => {
    if (!node) return null;

    const { type, props = {}, children: structuralChildren = [] } = node;
    const { content, innerHTML, style, className, children: propsChildren, name: iconName, ...rest0 } = props;

    // 1. Determine the component type to render
    const CustomComponent = COMPONENT_MAP[type];
    const isSvg = SVG_TAGS.has(type);
    const componentType = CustomComponent || (isSvg ? type : (HTML_TAG_MAP[type] ?? 'div'));

    // 2. Handle special 'latex' type
    if (type === 'latex') {
      const latexContent = unicodeToLatex(content || '');
      return props.block
        ? <BlockMath strict={false}>{latexContent}</BlockMath>
        : <InlineMath strict={false}>{latexContent}</InlineMath>;
    }

    // 3. Prepare props
    const rest = ensureVisibleDefaults(type, rest0);
    const styleObj = (typeof style === 'object' && style) ? style : undefined;

    // 4. Determine children to render
    let finalChildren: React.ReactNode = null;
    const textualContent = typeof propsChildren === 'string' ? propsChildren : content;

    if (type === 'icon') {
      // 아이콘 타입일 경우: props.name 또는 children으로 이름 지정 허용
      const nm = iconName || textualContent || (Array.isArray(structuralChildren) && structuralChildren[0]?.props?.name) || '';
      finalChildren = <LucideIcon name={nm} />;
      return React.createElement(componentType as any, { ...rest, style: styleObj, className }, finalChildren);
    }

    if (typeof textualContent === 'string') {
      finalChildren = renderContentWithLatex(textualContent);
    } else if (Array.isArray(structuralChildren) && structuralChildren.length > 0) {
      finalChildren = structuralChildren.map((c, i) => <React.Fragment key={i}>{renderNode(c)}</React.Fragment>);
    }

    // 5. Create and return the element
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
