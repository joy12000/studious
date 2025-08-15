// src/pages/CapturePage.tsx
import React, { useEffect, useRef, useState } from "react";
import { Clipboard, Save as SaveIcon, Trash2, AlertTriangle, Check } from "lucide-react";
import { safeCreateNoteFromText } from "../lib/safeCreateNote";

function cleanText(s: string) {
  if (!s) return s;
  try {
    // 보수적 클리닝: 개행/공백 정리 + 스마트 따옴표 정규화
    let t = s.replace(/\r\n/g, "\n");
    t = t.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    t = t.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ");
    return t.trim();
  } catch {
    return s;
  }
}

export default function CapturePage() {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const chars = value.length;

  async function handlePaste() {
    setErr(null);
    setInfo(null);
    try {
      setBusy(true);
      let text = "";
      try {
        // 권한 없으면 여기서 throw 가능
        text = await navigator.clipboard.readText();
      } catch {
        // 폴백: 직접 붙여넣기 유도
        setInfo("클립보드 권한이 거부되었거나 접근이 차단되었습니다. 아래 입력창에 직접 붙여넣어 주세요.");
        return;
      }
      if (!text || !text.trim()) {
        setInfo("클립보드에 텍스트가 비어 있습니다. 아래 입력창에 직접 붙여넣어 주세요.");
        return;
      }
      const cleaned = cleanText(text);
      const id = await safeCreateNoteFromText(cleaned);
      location.assign(`/note/${id}`);
    } catch (e: any) {
      console.error("[Capture paste]", e);
      if (mounted.current) setErr(e?.message || "붙여넣기 중 오류가 발생했습니다.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function handleSave() {
    setErr(null);
    setInfo(null);
    try {
      setBusy(true);
      const cleaned = cleanText(value);
      const id = await safeCreateNoteFromText(cleaned);
      location.assign(`/note/${id}`);
    } catch (e: any) {
      console.error("[Capture save]", e);
      if (mounted.current) setErr(e?.message || "저장 중 오류가 발생했습니다.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  function handleClear() {
    setValue("");
    setErr(null);
    setInfo(null);
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">노트 캡처</h1>
          <p className="text-sm text-gray-500">붙여넣거나 직접 입력해서 바로 저장하세요.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePaste}
            disabled={busy}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded ${busy ? "bg-gray-200 text-gray-500" : "bg-emerald-600 text-white hover:brightness-110"}`}
            title="클립보드에서 가져오기"
          >
            <Clipboard className="h-4 w-4" /> 붙여넣기
          </button>
          <button
            onClick={handleSave}
            disabled={busy || !value.trim()}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded ${busy || !value.trim() ? "bg-gray-200 text-gray-500" : "bg-blue-600 text-white hover:brightness-110"}`}
            title="입력한 내용 저장"
          >
            <SaveIcon className="h-4 w-4" /> 저장
          </button>
          <button
            onClick={handleClear}
            disabled={busy || !value}
            className="inline-flex items-center gap-2 px-3 py-2 rounded border bg-white hover:bg-gray-50"
            title="지우기"
          >
            <Trash2 className="h-4 w-4" /> 지우기
          </button>
        </div>
      </header>

      {/* 알림 영역 */}
      {err && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <div>{err}</div>
        </div>
      )}
      {info && (
        <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-3">
          <Check className="h-4 w-4 mt-0.5" />
          <div>{info}</div>
        </div>
      )}

      {/* 입력 영역 */}
      <textarea
        id="capture-ta"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="여기에 텍스트를 붙여넣거나 작성하세요."
        className="w-full min-h-[320px] border rounded-lg p-3 outline-none"
      />

      {/* 푸터: 글자수/도움말 */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div>글자 수: {chars.toLocaleString()}</div>
        <div>팁: 권한 거부가 뜨면 입력창에 직접 붙여넣고 ‘저장’을 누르세요.</div>
      </div>
    </div>
  );
}