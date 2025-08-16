import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TemplatePicker from "../components/TemplatePicker";
import TopicBadge from "../components/TopicBadge";
import { cleanPaste } from "../lib/cleanPaste";
import { readClipboardText } from "../lib/clipboard";
import { suggestTopics } from "../lib/topicSuggest";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TemplatePicker from "../components/TemplatePicker";
import TopicBadge from "../components/TopicBadge";
import { cleanPaste } from "../lib/cleanPaste";
import { readClipboardText } from "../lib/clipboard";
import { suggestTopics } from "../lib/topicSuggest";
import { createNoteUniversal } from "../lib/createNoteAdapter";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom"; // Added Link import
import { ArrowLeft } from "lucide-react"; // Added ArrowLeft import

// ---------- Robust Paste binding to existing FAB labeled '붙여넣기' ----------
const MARK_ATTR = "data-robust-paste-bound";
function isPasteButton(el: Element): boolean {
  const node = el as HTMLElement;
  const text = node.innerText?.trim() || "";
  const aria = node.getAttribute("aria-label") || "";
  const title = node.title || "";
  return /붙여넣기|paste/i.test(text + " " + aria + " " + title);
}
function mark(node: HTMLElement) { node.setAttribute(MARK_ATTR, "1"); }
function isMarked(node: HTMLElement) { return node.getAttribute(MARK_ATTR) === "1"; }

function useBindPasteFab(handler: () => void) {
  useEffect(() => {
    const candidates = Array.from(document.querySelectorAll("button, [role='button']"))
      .filter(isPasteButton) as HTMLElement[];
    if (candidates.length > 0) {
      // keep the first, hide duplicates
      const [main, ...dupes] = candidates;
      dupes.forEach(d => (d.style.display = "none"));
      if (!isMarked(main)) {
        main.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); handler(); }, { passive: false });
        mark(main);
      }
    }
    const mo = new MutationObserver(() => {
      const news = Array.from(document.querySelectorAll("button, [role='button']")).filter(isPasteButton) as HTMLElement[];
      if (news.length > 0) {
        const [main, ...dupes] = news;
        dupes.forEach(d => (d.style.display = "none"));
        if (!isMarked(main)) {
          main.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); handler(); }, { passive: false });
          mark(main);
        }
      }
    });
    if (document.body) mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [handler]);
}

// ------------------------------- Page --------------------------------
export default function CapturePage() {
  const [text, setText] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [creatorLabel, setCreatorLabel] = useState<string>("");
  const [aiTopics, setAiTopics] = useState<string[]>([]);
  const [useSmartClean, setUseSmartClean] = useState<boolean>(() => {
    const v = localStorage.getItem("smartPaste.enabled");
    return v ? v === "1" : true;
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const busyRef = useRef(false);

  const handleFabPaste = useCallback(async () => {
    try {
      const res = await readClipboardText();
      if (!res.ok) {
        setStatus(res.message || "클립보드에서 읽을 수 없어요.");
        return;
      }
      const input = res.text || "";
      const cleaned = useSmartClean ? cleanPaste(input) : input;
      setText(prev => (prev ? prev + "\n" + (prev.endsWith("\n") ? "" : "\n") + cleaned : cleaned)); // Fixed newline handling
      setStatus("붙여넣기 완료");
      textareaRef.current?.focus();
      refreshAiTopics(cleaned);
    } catch {
      setStatus("붙여넣기에 실패했어요.");
    }
  }, [useSmartClean]);

  useBindPasteFab(handleFabPaste);

  function refreshAiTopics(src: string) {
    try {
      const s = (text ? text + "\n" : "") + src;
      const top = suggestTopics(s);
      setAiTopics(top.slice(0, 6));
    } catch {
      /* noop */
    }
  }

  async function onSave() {
    if (busyRef.current) return;
    const input = text.trim();
    if (!input) {
      setStatus("내용이 비어 있어요.");
      return;
    }
    busyRef.current = true;
    try {
      const processed = useSmartClean ? cleanPaste(input) : input;
      setStatus("저장 준비 중…");
      // Removed getNoteCreator and related logic
      const id = await createNoteUniversal(processed); // Direct call
      if (!id) {
        setStatus("저장 실패: 반환된 ID가 비어있어요.");
        busyRef.current = false;
        return;
      }
      setStatus("저장 완료");
      window.location.assign(`/note/${encodeURIComponent(String(id))}`);
    } catch (e) {
      console.error(e);
      setStatus("저장 중 오류가 발생했어요.");
    } finally {
      busyRef.current = false;
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      <header className="flex items-center gap-4 justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="p-2 rounded-lg border bg-white/80 hover:bg-white transition-colors"
            title="뒤로가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">캡처</h1>
        </div>
        <div className="flex items-center gap-2">
          <TemplatePicker
            onInsert={(tpl) => {
              const content = tpl || "";
              const filled = content
                .replaceAll("{{date}}", new Date().toISOString().slice(0,10))
                .replaceAll("{{time}}", new Date().toTimeString().slice(0,5));
              setText(prev => (prev ? prev + "\n\n" + filled : filled));
              refreshAiTopics(filled);
            }}
          />
          <label className="text-xs flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300/50 bg-white/50 hover:bg-white/80 transition-colors">
            <input
              type="checkbox"
              checked={useSmartClean}
              onChange={(e) => {
                const v = e.target.checked;
                setUseSmartClean(v);
                localStorage.setItem("smartPaste.enabled", v ? "1" : "0");
              }}
            />
            고급 클리닝
          </label>
        </div>
      </header>

      {status && (
        <div className="banner mb-4">
          {status}
        </div>
      )}

      <section className="p-6 bg-white/60 backdrop-blur-lg rounded-2xl shadow-lg border border-white/20 mb-6">
        <div className="text-xs mb-3 opacity-70">AI 주제 추천</div>
        <div className="flex flex-wrap gap-3">
          {aiTopics.length === 0 ? (
            <span className="text-xs text-gray-500">내용을 입력하거나 붙여넣기 하면 추천이 보여요.</span>
          ) : (
            aiTopics.map((t) => <TopicBadge key={t} topic={t} variant="small" />)
          )}
        </div>
      </section>

      <section className="p-6 bg-white/60 backdrop-blur-lg rounded-2xl shadow-lg border border-white/20 mb-6">
        <textarea
          ref={textareaRef}
          className="w-full min-h-[40vh] px-4 py-3 border border-gray-300/50 bg-white/60 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-y transition-colors"
          placeholder="여기에 붙여넣기 또는 직접 입력…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            refreshAiTopics(e.target.value);
          }}
        />
        <div className="mt-4 text-right">
          <button className="inline-flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors text-sm font-semibold" onClick={onSave}>이 내용으로 저장</button>
        </div>
      </section>

      <section className="p-6 bg-white/60 backdrop-blur-lg rounded-2xl shadow-lg border border-white/20">
        <div className="text-sm font-medium mb-3">고급 클리닝은 이렇게 정리해요</div>
        <ul className="text-sm leading-relaxed list-disc pl-5 text-gray-700">
          <li><b>코드블록</b>(``` … ```)은 건드리지 않아요.</li>
          <li>글머리표는 제각각이면 <code>-</code> 하나로 통일해요.</li>
          <li>번호목록은 <code>1)</code>/<code>1 -</code>도 <code>1.</code>로 맞춰요.</li>
          <li>“스마트 따옴표”와 숨은 공백은 일반 문자로 바꿔요.</li>
          <li>링크의 추적 꼬리표(<code>utm_</code>, <code>gclid</code> 등)는 지워서 짧게 만들어요.</li>
        </ul>
      </section>
    </div>
  );
}