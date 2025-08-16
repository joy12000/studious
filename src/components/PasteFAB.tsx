import React from "react";
import { ClipboardPaste } from 'lucide-react';

type Props = { onClick: () => void };

export default function PasteFAB({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="z-40 inline-flex items-center justify-center w-14 h-14 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-transform"
      aria-label="붙여넣기"
      title="붙여넣기"
    >
      <ClipboardPaste className="w-6 h-6" />
    </button>
  );
}
