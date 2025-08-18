import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import TemplatePicker, { UserTemplate } from "../components/TemplatePicker";
import TopicBadge from "../components/TopicBadge";
import { cleanPaste } from "../lib/cleanPaste";
import { readClipboardText } from "../lib/clipboard";
import { useNotes } from "../lib/useNotes";
import { guessTopics } from "../lib/classify";

// ---------- Robust Paste binding to existing FAB labeled '붙여넣기' ----------
// (이 부분은 변경되지 않았으므로 생략)
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

// GEMINI: 템플릿 관련 로직 추가
const TEMPLATE_LS_KEY = "userTemplates";
const defaults: UserTemplate[] = [
  { id: "default-meeting", name: "회의 메모", content: "## 안건\n- \n\n## 핵심 결론\n- \n\n## 할 일(To-Do)\n- [ ] 담당자:  / 마감: \n\n## 참고\n- \n" },
  { id: "default-reading", name: "독서 노트", content: "## 책/출처\n- \n\n## 인상 깊은 문장\n> \n\n## 요약\n- \n\n## 적용 아이디어\n- \n" },
  { id: "default-idea", name: "아이디어 스케치", content: "## 한 줄\n- \n\n## 문제/고객\n- \n\n## 해결 아이디어\n- \n\n## 다음 실험\n- 가설: \n- 지표: \n- 마감: \n" }
];

function loadUserTemplates(): UserTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATE_LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getTemplateContent(id: string, allTemplates: UserTemplate[]): UserTemplate | undefined {
  return allTemplates.find(t => t.id === id);
}

function renderTemplate(src: string, name: string): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5);
  const filled = src.replace(/\{\{date\}\}/g, date).replace(/\{\{time\}\}/g, time);
  return `\n\n---\n### 템플릿: ${name}\n${filled}\n---`;
}

export default function CapturePage() {
  const { addNote } = useNotes();
  const [userContent, setUserContent] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [aiTopics, setAiTopics] = useState<string[]>([]);
  const [useSmartClean, setUseSmartClean] = useState<boolean>(() => localStorage.getItem("smartPaste.enabled") !== "0");
  
  // GEMINI: 템플릿 상태 및 로직 수정
  const [activeTemplates, setActiveTemplates] = useState<string[]>([]);
  const allTemplates = useMemo(() => [...defaults, ...loadUserTemplates()], []);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const busyRef = useRef(false);

  const refreshAiTopics = useCallback(async (src: string) => {
    if (src.trim().length < 20) {
      setAiTopics([]);
      return;
    }
    try {
      const top = await guessTopics(src);
      setAiTopics(top.slice(0, 6));
    } catch {} 
  }, []);

  useEffect(() => {
    refreshAiTopics(userContent);
  }, [userContent, refreshAiTopics]);

  const handleFabPaste = useCallback(async () => {
    try {
      const res = await readClipboardText();
      if (!res.ok) {
        setStatus('클립보드에서 읽을 수 없어요.');
        return;
      }
      const input = res.text || "";
      const cleaned = useSmartClean ? cleanPaste(input) : input;
      setUserContent(prev => prev ? prev + "\n\n" + cleaned : cleaned);
      setStatus("붙여넣기 완료");
      textareaRef.current?.focus();
    } catch {
      setStatus("붙여넣기에 실패했어요.");
    }
  }, [useSmartClean]);

  useBindPasteFab(handleFabPaste);

  async function onSave() {
    if (busyRef.current) return;
    const input = userContent.trim();
    if (!input) {
      setStatus("내용이 비어 있어요.");
      return;
    }
    busyRef.current = true;
    try {
      const processed = useSmartClean ? cleanPaste(input) : input;
      setStatus("저장 준비 중…");
      const newNote = await addNote({ content: processed });
      if (!newNote?.id) {
        setStatus("저장 실패: 반환된 ID가 비어있어요.");
        busyRef.current = false;
        return;
      }
      setStatus("저장 완료");
      window.location.assign(`/note/${encodeURIComponent(String(newNote.id))}`);
    } catch (e) {
      console.error(e);
      setStatus("저장 중 오류가 발생했어요.");
    } finally {
      busyRef.current = false;
    }
  }

  // GEMINI: 템플릿 토글 시 본문에 직접 추가하도록 핸들러 수정
  const handleTemplateToggle = (id: string) => {
    // 이미 활성화된 템플릿을 체크 해제하는 경우, 텍스트 내용은 변경하지 않고 상태만 업데이트합니다.
    if (activeTemplates.includes(id)) {
      setActiveTemplates(prev => prev.filter(tId => tId !== id));
      return;
    }

    // 새 템플릿을 체크하는 경우, 내용을 본문에 추가합니다.
    const template = getTemplateContent(id, allTemplates);
    if (template) {
      const renderedContent = renderTemplate(template.content, template.name);
      // 본문이 비어있으면 앞의 개행 없이, 내용이 있으면 개행과 함께 추가합니다.
      setUserContent(prev => (prev.trim() ? prev + renderedContent : renderedContent.trim()));
      setActiveTemplates(prev => [...prev, id]);
      
      // 텍스트 추가 후 포커스 및 스크롤 맨 아래로 이동
      textareaRef.current?.focus();
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
        }
      }, 0);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      <header className="flex items-center gap-4 justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="p-2 rounded-lg border bg-card/80 hover:bg-card transition-colors"
            title="뒤로가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">캡처</h1>
        </div>
        <div className="flex items-center gap-2">
          <TemplatePicker
            activeTemplates={activeTemplates}
            onTemplateToggle={handleTemplateToggle}
          />
          <label className="text-xs flex items-center gap-2 px-3 py-2 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors">
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

      <section className="p-6 bg-card/60 backdrop-blur-lg rounded-2xl shadow-lg border border-card/20 mb-6">
        <div className="text-xs mb-3 opacity-70">AI 주제 추천</div>
        <div className="flex flex-wrap gap-3">
          {aiTopics.length === 0 ? (
            <span className="text-xs text-muted-foreground">내용을 입력하거나 붙여넣기 하면 추천이 보여요.</span>
          ) : (
            aiTopics.map((t) => <TopicBadge key={t} topic={t} variant="small" />)
          )}
        </div>
      </section>

      <section className="p-6 bg-card/60 backdrop-blur-lg rounded-2xl shadow-lg border border-card/20 mb-6">
        <textarea
          ref={textareaRef}
          className="w-full min-h-[30vh] px-4 py-3 border bg-card/60 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent resize-y transition-colors"
          placeholder="여기에 붙여넣기 또는 직접 입력…"
          value={userContent}
          onChange={(e) => setUserContent(e.target.value)}
        />
        
        <div className="mt-4 text-right">
          <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors text-sm font-semibold" onClick={onSave}>이 내용으로 저장</button>
        </div>
      </section>

      <section className="p-6 bg-card/60 backdrop-blur-lg rounded-2xl shadow-lg border border-card/20">
        <div className="text-sm font-medium mb-3">고급 클리닝은 이렇게 정리해요</div>
        <ul className="text-sm leading-relaxed list-disc pl-5 text-muted-foreground">
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
