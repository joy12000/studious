// src/components/VisualRenderer.tsx
import React from 'react';
import ShadowHost from './ShadowHost';
import { InlineMath, BlockMath } from 'react-katex';
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from './ui/card';
import { icons } from 'lucide-react'; // Import icons
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
// Dynamically renders a Lucide icon based on the 'name' prop.
const LucideIcon = ({ name, ...props }: { name: string }) => {
  const Icon = icons[name as keyof typeof icons];
  if (!Icon) {
    console.warn(`Icon "${name}" not found in lucide-react.`);
    return <span style={{ color: 'red' }}>[Icon: {name}? ]</span>;
  }
  return <Icon {...props} />;
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
  icon: LucideIcon, // Add icon to the map
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
    const { content, innerHTML, style, className, children: propsChildren, ...rest0 } = props;

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