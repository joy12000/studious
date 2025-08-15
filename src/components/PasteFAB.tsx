import React from "react";

type Props = { onClick: () => void };

export default function PasteFAB({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-5 right-5 md:bottom-6 md:right-6 z-40 inline-flex items-center gap-2 px-4 py-3 rounded-full shadow-lg bg-blue-600 text-white hover:bg-blue-700 active:translate-y-px"
      aria-label="붙여넣기"
      title="붙여넣기"
    >
      <span className="inline-block w-5 h-5 border rounded-sm bg-white/20" aria-hidden="true"></span>
      붙여넣기
    </button>
  );
}
