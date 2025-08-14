import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clipboard, Check, AlertCircle } from 'lucide-react';
import { useNotes } from '../lib/useNotes';

/**
 * 전역 플로팅 버튼: /capture 경로에서만 나타나며
 * 클릭 시 클립보드 텍스트를 읽어 즉시 노트로 저장하고 상세 페이지로 이동합니다.
 * - 페이지 UI를 건드리지 않기 위해 Root 에서 전역으로 마운트합니다.
 */
export default function ClipboardCaptureAgent() {
  const loc = useLocation();
  const onCapturePage = useMemo(() => (loc.pathname || '').startsWith('/capture'), [loc.pathname]);
  const { addNote } = useNotes();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!onCapturePage) setToast(null);
  }, [onCapturePage]);

  async function pasteAndSave() {
    if (!onCapturePage) return;
    if (!('clipboard' in navigator) || !navigator.clipboard?.readText) {
      setToast('클립보드 API를 지원하지 않아요. HTTPS 환경인지 확인해 주세요.');
      return;
    }
    try {
      setBusy(true);
      const text = (await navigator.clipboard.readText() || '').trim();
      if (!text) {
        setToast('클립보드에 텍스트가 없습니다.');
        return;
      }
      const id = await addNote(text);
      setToast('저장 완료!');
      setTimeout(() => setToast(null), 1200);
      nav(`/note/${id}`);
    } catch (e: any) {
      const msg = (e?.message || e || '').toString();
      if (msg.toLowerCase().includes('permission')) {
        setToast('클립보드 권한이 필요합니다. 한 번 허용해 주세요.');
      } else {
        setToast('붙여넣기에 실패했어요.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (!onCapturePage) return null;

  return (
    <>
      <button
        onClick={pasteAndSave}
        disabled={busy}
        title="클립보드 붙여넣기 → 자동 저장"
        className={`fixed bottom-16 right-3 z-[9998] inline-flex items-center gap-2 px-3 py-2 rounded-full shadow-md border
          ${busy ? 'bg-gray-200 text-gray-500 border-gray-200' : 'bg-blue-600 text-white border-blue-600 hover:brightness-110'}`}
      >
        <Clipboard className="h-4 w-4" />
        <span className="text-sm">붙여넣기</span>
      </button>

      {toast && (
        <div className="fixed bottom-2 right-3 z-[9999]">
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg shadow bg-black/80 text-white">
            {toast.includes('완료') ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
            <span>{toast}</span>
          </div>
        </div>
      )}
    </>
  );
}