// src/components/VisualRenderer.tsx
import React from 'react';

// 핵심: SVG 문자열 직렬화 -> data URL -> <img>로 표시(외부 CSS 불가)
function svgFromConfig(cfg:any): string {
  const esc = (s:string) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const node = (n:any): string => {
    if (!n) return '';
    const { type, props = {}, children = [] } = n;
    const attrs = Object.entries(props)
      .filter(([k,v]) => k !== 'content' && k !== 'style')
      .map(([k,v]) => `${k}="${esc(v as string)}"`).join(' ');
    const style = props.style ? ` style="${Object.entries(props.style).map(([k,v])=>`${k}:${v}`).join(';')}"` : '';
    const open = `<${type}${attrs? ' '+attrs:''}${style}>`;
    const inner = (props.content ?? '') + (children||[]).map(node).join('');
    return `${open}${inner}</${type}>`;
  };
  const svg = node(cfg);
  // 최소 사이즈 보장
  return svg.includes('<svg') ? svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="280"') : svg;
}

const VisualRenderer: React.FC<{config:any}> = ({config}) => {
  try {
    if (!config) return null;
    const svg = svgFromConfig(config);
    const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    return <img alt="visual diagram" src={url} style={{display:'block',maxWidth:'100%', backgroundColor: 'white'}}/>;
  } catch (e) {
    console.error("VisualRenderer failed:", e);
    return <pre style={{color: 'red'}}>Visual-IMG 렌더링 오류</pre>;
  }
};

export default VisualRenderer;