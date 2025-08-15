import React, { useEffect, useRef, useState } from "react";
import TopicBadge from "../components/TopicBadge";
import TemplatePicker from "../components/TemplatePicker";
import { cleanPaste } from "../lib/cleanPaste";
import { readClipboardText } from "../lib/clipboard";
import { suggestTopics } from "../lib/topicSuggest";
import { createNoteUniversal } from "../lib/createNoteAdapter";
import { getNoteCreator } from "../lib/findCreateNote";

// --- Utilities to bind our robust paste handler to an existing FAB button ---
const MARK_ATTR = "data-robust-paste-bound";

function isPasteButton(el: Element): boolean {
  const node = el as HTMLElement;
  const text = node.innerText?.trim() || "";
  const aria = node.getAttribute("aria-label") || "";
  const title = node.getAttribute("title") || "";
  return /붙여넣기/.test(text + aria + title);
}

function mark(el: HTMLElement) {
  el.setAttribute(MARK_ATTR, "1");
}
function isMarked(el: HTMLElement) {
  return el.hasAttribute(MARK_ATTR);
}

function bindPasteToExistingFAB(handler: () => void) {
  const nodes = Array.from(document.querySelectorAll("button"));
  const candidates = nodes.filter(n => isPasteButton(n));
  // Hide duplicates (keep the first visible)
  if (candidates.length > 1) {
    candidates.slice(1).forEach(n => ((n as HTMLElement).style.display = "none"));
  }
  const target = candidates[0] as HTMLElement | undefined;
  if (target && !isMarked(target)) {
    target.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        handler();
      },
      { passive: false }
    );
    mark(target);
  }
  // Watch for late-added buttons and (re)bind
  const mo = new MutationObserver(() => {
    const news = Array.from(document.querySelectorAll("button")).filter(n => isPasteButton(n));
    if (news.length > 0) {
      if (news.length > 1) news.slice(1).forEach(n => ((n as HTMLElement).style.display = "none"));
      const t = news[0] as HTMLElement;
      if (t && !isMarked(t)) {
        t.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); handler(); }, { passive: false });
        mark(t);
      }
    }
  });
  if (document.body) mo.observe(document.body, { childList: true, subtree: true });
  return () => mo.disconnect();
}

export default function CapturePage() {
  const [status, setStatus] = useState<string>("");
  const [text, setText] = useState<string>("");
  const [useSmartClean, setUseSmartClean] = useState<boolean>(() => {
    const v = localStorage.getItem("smartPaste.enabled");
    return v ? v === "1" : true;
  });
  const [aiTopics, setAiTopics] = useState<string[]>([]);
  const [creatorLabel, setCreatorLabel] = useState<string>("");
  const busyRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    localStorage.setItem("smartPaste.enabled", useSmartClean ? "1" : "0");
  }, [useSmartClean]);

  async function handlePaste() {
    setStatus("클립보드 확인 중…");
    const res = await readClipboardText();
    if (!res.ok) {
      switch (res.reason) {
        case "no_api":
          setStatus("이 환경에선 자동 붙여넣기를 쓸 수 없어요. 아래 입력창에 Ctrl/⌘+V로 붙여넣기 해주세요.");
          break;
        case "denied":
          setStatus("클립보드 권한이 거부됐어요. 브라우저 설정에서 허용하거나, 아래 입력창에 직접 붙여넣기 해주세요.");
          break;
        case "empty":
          setStatus("클립보드가 비어 있어요. 복사 후 다시 시도하거나 아래에 직접 붙여넣기 하세요.");
          break;
        default:
          setStatus("클립보드 읽기에 실패했어요. 아래 입력창에 직접 붙여넣기 하세요.");
      }
      textareaRef.current?.focus();
      return;
    }
    const pasted = useSmartClean ? cleanPaste(res.text) : res.text;
    setText(prev => (prev ? (prev + (prev.endsWith("\n") ? "" : "\n") + pasted) : pasted));
    setStatus("붙여넣기 완료");
    textareaRef.current?.focus();
    refreshAiTopics(prev => pasted + "\n" + prev);
  }

  async function saveNote(rawInput: unknown) {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const processed = useSmartClean ? cleanPaste(rawInput) : (typeof rawInput === "string" ? rawInput : String(rawInput ?? ""));
      if (!processed.trim()) {
        setStatus("비어 있는 내용은 저장하지 않아요.");
        return;
      }
      setStatus("저장 준비 중…");
      const resolved = await getNoteCreator();
      if (!resolved) {
        setStatus("저장 실패: safeCreateNote를 찾을 수 없어요.");
        return;
      }
      setCreatorLabel(resolved.name);
      setStatus("저장 중…");
      const id = await createNoteUniversal(resolved.mod as any, processed);
      if (!id) {
        setStatus("저장 실패: 반환된 ID가 비어있어요.");
        return;
      }
      location.assign(`/note/${encodeURIComponent(id)}`);
    } catch (e: any) {
      console.error(e);
      const msg = String(e?.message || e || "");
      setStatus(`저장 실패: ${msg.slice(0, 100)}`);
      setText(typeof rawInput === "string" ? rawInput : String(rawInput ?? ""));
    } finally {
      busyRef.current = false;
    }
  }

  function refreshAiTopics(src?: string | ((prev: string) => string)) {
    const sample = typeof src === "function" ? src(text) : (src ?? text);
    const sugg = suggestTopics(sample, 5);
    setAiTopics(sugg);
  }

  useEffect(() => {
    refreshAiTopics(text);
  }, [text]);

  // 기존 우하단 파란 FAB에 로직 바인딩
  useEffect(() => {
    (window as any).__ROBUST_PASTE__ = handlePaste;
    return bindPasteToExistingFAB(handlePaste);
  }, [useSmartClean, text]);

  return (
    <div className="max-w-3xl mx-auto p-5 md:p-8 space-y-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">캡처</h1>
        <div className="flex items-center gap-2">
          <TemplatePicker
            onInsert={(content) => {
              setText(prev => (prev ? (prev + (prev.endsWith("\n") ? "" : "\n") + content) : content));
              textareaRef.current?.focus();
            }}
          />
          <label className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm bg-white/70 dark:bg-gray-900/60">
            <input
              type="checkbox"
              checked={useSmartClean}
              onChange={(e) => setUseSmartClean(e.target.checked)}
            />
            고급 클리닝
          </label>
        </div>
      </header>

      {status && (
        <div className="text-sm px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
          {status} {creatorLabel ? <span className="opacity-60">({creatorLabel})</span> : null}
        </div>
      )}

      <section className="rounded-2xl border p-4 bg-white/70 dark:bg-gray-900/60"><div className="text-sm font-medium mb-2">고급 클리닝은 이렇게 정리해요</div><ul className="text-sm leading-6 list-disc pl-5"><li><b>코드블록</b>(``` … ```)은 건드리지 않아요.</li><li>글머리표는 제각각이면 <code>-</code> 하나로 통일해요.</li><li>번호목록은 <code>1)</code>/<code>1 -</code>도 <code>1.</code>로 맞춰요.</li><li>“스마트 따옴표”와 숨은 공백은 일반 문자로 바꿔요.</li><li>링크의 추적 꼬리표(<code>utm_</code>, <code>gclid</code> 등)는 지워서 짧게 만들어요.</li></ul></section>
    </div>
  );
}
