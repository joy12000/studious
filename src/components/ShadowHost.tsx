import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  /** Shadow root 안에 주입할 글로벌 스타일(CSS 텍스트) */
  styleText?: string;
  children: React.ReactNode;
};

/** 외부 CSS가 침투하지 못하도록 Shadow DOM을 만들어 주는 래퍼 */
const ShadowHost: React.FC<Props> = ({ styleText, children }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    // 한 번만 attach
    const shadow = hostRef.current.shadowRoot ?? hostRef.current.attachShadow({ mode: 'open' });
    // 스타일 주입
    if (styleText) {
      const styleEl = document.createElement('style');
      styleEl.textContent = styleText;
      shadow.appendChild(styleEl);
    }
    // 실제 렌더 타겟 div
    const mountEl = document.createElement('div');
    shadow.appendChild(mountEl);
    setMount(mountEl);
  }, [styleText]);

  return (
    <div ref={hostRef}>
      {mount ? createPortal(children, mount) : null}
    </div>
  );
};

export default ShadowHost;
