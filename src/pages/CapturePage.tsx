import React, { useEffect, useRef, useState, Suspense } from "react";
import TemplatePicker from "../components/TemplatePicker";
import { cleanPaste } from "../lib/cleanPaste";
import { readClipboardText } from "../lib/clipboard";
import { suggestTopics } from "../lib/topicSuggest";
import * as Safe from "../lib/safeCreateNote";
import { createNoteUniversal } from "../lib/createNoteAdapter";
import PasteFAB from "../components/PasteFAB";

// Optional legacy AI topic UI auto-detect (non-breaking)
const legacyCandidates = import.meta.glob("../components/**/AITopic*.tsx");
const LegacyTopic = Object.keys(legacyCandidates).length
  ? React.lazy(Object.values(legacyCandidates)[0] as any)
  : null;

export default function CapturePage() {
  const [status, setStatus] = useState<string>("");
  const [text, setText] = useState<string>("");
  const [useSmartClean, setUseSmartClean] = useState<boolean>(() => {
    const v = localStorage.getItem("smartPaste.enabled");
    return v ? v === "1" : true;
  });
  const [aiTopics, setAiTopics] = useState<string[]>([]);
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
      setStatus("저장 중…");
      const id = await createNoteUniversal(Safe as any, processed);
      if (!id) {
        setStatus("저장에 실패했어요(빈 ID). 잠시 후 다시 시도해주세요.");
        return;
      }
      location.assign(`/note/${encodeURIComponent(id)}`);
    } catch (e) {
      console.error(e);
      setStatus("저장에 실패했어요. 내용은 아래 편집창에 남겨 둘게요.");
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

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      {/* 상단 붙여넣기 버튼은 제거 */}
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">캡처</h1>
        <div className="flex items-center gap-2">
          <TemplatePicker
            onInsert={(content) => {
              setText(prev => (prev ? (prev + (prev.endsWith("\n") ? "" : "\n") + content) : content));
              textareaRef.current?.focus();
            }}
          />
          <label className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm">
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
          {status}
        </div>
      )}

      {/* AI 주제 영역: 레거시가 있으면 해당 컴포넌트를 우선 사용 */}
      {LegacyTopic ? (
        <Suspense fallback={<div className="text-xs text-gray-500">AI 주제 로딩 중…</div>}>
          <LegacyTopic text={text} />
        </Suspense>
      ) : (
        <section className="rounded-2xl border p-3 bg-white/60 dark:bg-gray-900/50">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">AI 주제 추천</div>
            <button
              className="text-xs px-2 py-1 rounded border hover:bg-gray-50 dark:hover:bg-gray-800"
              onClick={() => refreshAiTopics()}
            >
              다시 분석
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {aiTopics.length === 0 ? (
              <span className="text-xs text-gray-500">아직 추천이 없어요. 내용을 입력하거나 붙여넣기 해보세요.</span>
            ) : (
              aiTopics.map(t => (
                <span key={t} className="text-xs px-2 py-1 rounded-full border bg-gray-50 dark:bg-gray-800">
                  #{t}
                </span>
              ))
            )}
          </div>
        </section>
      )}

      <div className="space-y-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="여기에 직접 붙여넣기 하거나, 템플릿을 선택해 시작하세요."
          className="w-full h-72 px-3 py-2 rounded-2xl border bg-transparent font-mono text-sm"
        />
        <div className="flex flex-wrap justify-end gap-2">
          {/* 인라인 붙여넣기 버튼은 제거하여 중복 없앰 */}
          <button
            className="px-3 py-2 rounded-xl border hover:bg-gray-50 dark:hover:bg-gray-800"
            onClick={() => setText("")}
          >
            지우기
          </button>
          <button
            className="px-3 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50"
            disabled={!text.trim()}
            onClick={() => saveNote(text)}
          >
            이 내용으로 저장
          </button>
        </div>
      </div>

      <section className="text-xs text-gray-500">
        <div className="font-semibold mb-1">고급 클리닝에 포함된 것</div>
        <ul className="list-disc pl-5 space-y-1">
          <li>코드 블록(<code>```</code>)은 그대로 보존</li>
          <li>리스트 기호 통일(•, ·, -, * → <code>-</code>) 및 번호목록 정리</li>
          <li>스마트 따옴표/숨은 공백 정리, 중복 빈 줄 축소</li>
          <li>URL의 UTM 등 추적 파라미터 제거</li>
        </ul>
      </section>

      {/* 우측 하단 고정 FAB에 강력한 붙여넣기 로직 연결 */}
      <PasteFAB onClick={handlePaste} />
    </div>
  );
}
