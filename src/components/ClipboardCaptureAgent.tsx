import React, { useEffect, useRef, useState } from 'react';
import { Clipboard, Check, AlertCircle, X } from 'lucide-react';
import { db } from '../lib/db';
import { guessTopics, generateTitle } from '../lib/classify';

function getPath(): string {
  const { pathname = '/', hash = '' } = window.location;
  if (hash && hash.startsWith('#')) {
    const p = hash.slice(1);
    return p.startsWith('/') ? p : `/${p}`;
  }
  return pathname || '/';
}

// locationchange wiring (for SPA awareness)
(function setupLocationChangeEvent(){
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).__locationChangePatched) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__locationChangePatched = true;
  const _push = history.pushState;
  const _replace = history.replaceState;
  function fire(){ window.dispatchEvent(new Event('locationchange')); }
  history.pushState = function(...args: Parameters<typeof history.pushState>){ _push.apply(this, args); fire(); }
  history.replaceState = function(...args: Parameters<typeof history.replaceState>){ _replace.apply(this, args); fire(); }
  window.addEventListener('popstate', fire);
  window.addEventListener('hashchange', fire);
})();

function genId(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = (crypto as any)?.randomUUID?.();
  if (g) return g;
  const r = Math.random().toString(36).slice(2, 8);
  return `n_${Date.now()}_${r}`;
}

async function saveRawNote(text: string) {
  const id = genId();
  const topics = await guessTopics(text);
  const title = generateTitle(text);
  const now = Date.now();
  await db.notes.put({
    id, content: text, topics,
    favorite: false, createdAt: now,
    title, sourceType: 'share', todo: []
  });
  return id;
}

export default function ClipboardCaptureAgent() {
  const [path, setPath] = useState<string>(getPath());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [fallbackText, setFallbackText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const onLoc = () => setPath(getPath());
    window.addEventListener('locationchange', onLoc);
    window.addEventListener('hashchange', onLoc);
    window.addEventListener('popstate', onLoc);
    return () => {
      window.removeEventListener('locationchange', onLoc);
      window.removeEventListener('hashchange', onLoc);
      window.removeEventListener('popstate', onLoc);
    };
  }, []);

  const onCapturePage = path.toLowerCase().startsWith('/capture');

  useEffect(() => {
    if (fallbackOpen) {
      const t = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [fallbackOpen]);

  useEffect(() => {
    if (!onCapturePage) {
      setToast(null);
      setFallbackOpen(false);
      setFallbackText('');
    }
  }, [onCapturePage]);

  function openFallback(message?: string) {
    if (message) setToast(message);
    setFallbackText('');
    setFallbackOpen(true);
  }

  async function navigateHard(href: string) {
    // 하드 네비게이션으로 라우터/상태 꼬임 방지
    location.assign(href);
  }

  async function pasteAndSave() {
    if (!onCapturePage) return;
    try {
      setBusy(true);
      const supported = !!navigator.clipboard?.readText;
      const secure = window.isSecureContext;

      if (supported && secure) {
        try {
          const text = (await navigator.clipboard.readText() || '').trim();
          console.debug('[ClipboardAgent] readText length=', text.length);
          if (text) {
            const id = await saveRawNote(text);
            setToast('저장 완료!'); setTimeout(() => setToast(null), 1000);
            await navigateHard(`/note/${id}`);
            return;
          } else {
            openFallback('클립보드가 비어 있어요. 직접 붙여넣기 해주세요.');
            return;
          }
        } catch (e) {
          console.warn('[ClipboardAgent] readText failed:', e);
          const msg = String(e instanceof Error ? e.message : e).toLowerCase();
          if (msg.includes('denied') || msg.includes('allow') || msg.includes('permission') || msg.includes('notallowed')) {
            openFallback('클립보드 권한이 차단되어 있어요. 직접 붙여넣기 해주세요.');
            return;
          }
          openFallback('이 브라우저에서는 직접 붙여넣기가 필요해요.');
          return;
        }
      } else {
        openFallback(secure ? '이 브라우저는 클립보드 API를 지원하지 않아요.' : 'HTTPS가 아니라서 읽을 수 없어요.');
        return;
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveFallback() {
    const text = fallbackText.trim();
    if (!text) { setToast('내용이 비어 있어요.'); return; }
    const id = await saveRawNote(text);
    setToast('저장 완료!');
    setFallbackOpen(false);
    setFallbackText('');
    setTimeout(() => setToast(null), 1000);
    await navigateHard(`/note/${id}`);
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

      {fallbackOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-lg border border-gray-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">클립보드에서 붙여넣기</h3>
              <button className="p-1 rounded hover:bg-gray-100" onClick={()=>setFallbackOpen(false)} aria-label="닫기">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-gray-600">
              자동 읽기가 제한되어 직접 붙여넣기가 필요합니다. (Windows: Ctrl+V, Mac: ⌘+V)
            </p>
            <textarea
              ref={textareaRef}
              value={fallbackText}
              onChange={e=>setFallbackText(e.target.value)}
              placeholder="여기에 붙여넣기…"
              className="w-full min-h-[160px] border rounded-lg p-2 outline-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={()=>setFallbackOpen(false)} className="px-3 py-2 text-sm rounded bg-gray-100">취소</button>
              <button onClick={saveFallback} className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded bg-blue-600 text-white">
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}