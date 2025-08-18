import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import RichTextEditor from '../components/RichTextEditor';
import TemplatePicker from "../components/TemplatePicker";
import TopicBadge from "../components/TopicBadge";
import AttachmentPanel from "../components/AttachmentPanel";
import { processContentForSaving } from "../lib/contentProcessor";
import { useNotes } from "../lib/useNotes";
import { guessTopics } from "../lib/classify";
import { Attachment } from "../lib/types";
import { v4 as uuidv4 } from 'uuid';


// ---------- Robust Paste binding to existing FAB labeled '붙여넣기' ----------
// (This section remains unchanged, so it's omitted for brevity)
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

export default function CapturePage() {
  const { addNote } = useNotes();
  
  const [userContent, setUserContent] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [aiTopics, setAiTopics] = useState<string[]>([]);
  const [activeTemplates, setActiveTemplates] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  
  const busyRef = useRef(false);
  const contentRef = useRef(userContent); // Ref to hold the latest content for callbacks

  useEffect(() => {
    contentRef.current = userContent;
  }, [userContent]);

  const refreshAiTopics = useCallback(async (htmlContent: string) => {
    // Create a temporary div to extract text content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const textContent = tempDiv.textContent || "";

    if (textContent.trim().length < 20) {
      setAiTopics([]);
      return;
    }
    try {
      const top = await guessTopics(textContent);
      setAiTopics(top.slice(0, 6));
    } catch (e) {
      console.error("Failed to guess topics:", e);
    }
  }, []);

  useEffect(() => {
    refreshAiTopics(userContent);
  }, [userContent, refreshAiTopics]);

  const handleFabPaste = useCallback(async () => {
    try {
      // Use the modern Clipboard API to get DataTransfer
      const clipboardItems = await navigator.clipboard.read();
      const data = new DataTransfer();
      
      for (const item of clipboardItems) {
        for (const type of item.types) {
          const blob = await item.getType(type);
          data.setData(type, await blob.text());
        }
      }

      const cleaned = await cleanPaste(data);
      
      // Append cleaned text. Tiptap will handle HTML conversion.
      setUserContent(prev => prev + cleaned);
      setStatus("붙여넣기 완료");
    } catch (err) {
      console.error("Paste failed:", err);
      setStatus("붙여넣기에 실패했어요. 브라우저 권한을 확인해주세요.");
    }
  }, []);

  useBindPasteFab(handleFabPaste);

  async function onSave() {
    if (busyRef.current) return;

    const processedContent = processContentForSaving(userContent);

    // Use a temporary div to get the text content for validation
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = processedContent;
    const textContent = tempDiv.textContent || "";

    if (textContent.trim().length === 0 && attachments.length === 0) {
      setStatus("내용이나 첨부파일이 비어 있어요.");
      return;
    }
    busyRef.current = true;
    try {
      setStatus("저장 준비 중…");
      // Save the processed content
      const newNote = await addNote({ content: processedContent, attachments });
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

  const handleTemplateToggle = useCallback((
    templateId: string,
    isAdding: boolean,
    contentToAdd?: { blockId: string; renderedContent: string }
  ) => {
    if (isAdding && contentToAdd) {
      // Append the new template content to the editor
      setUserContent(prev => prev + contentToAdd.renderedContent);
      setActiveTemplates(prev => ({ ...prev, [templateId]: contentToAdd.blockId }));
    } else {
      const blockId = activeTemplates[templateId];
      if (blockId) {
        // Use a more robust regex to remove the block, including surrounding whitespace
        const blockRegex = new RegExp(String.raw`  \s*<!-- ${blockId} -->.*?<!-- /${blockId} -->\s*`, "s");
        setUserContent(prev => prev.replace(blockRegex, ""));
        
        setActiveTemplates(prev => {
          const newState = { ...prev };
          delete newState[templateId];
          return newState;
        });
      }
    }
  }, [activeTemplates]);

  // GEMINI: 첨부파일 핸들러 함수들 추가
  const handleAddLink = () => {
    const url = prompt("추가할 URL을 입력하세요:", "https://");
    if (url) {
      try {
        new URL(url); // URL 유효성 검사
        setAttachments(prev => [...prev, { id: uuidv4(), type: 'link', url }]);
      } catch {
        alert("유효하지 않은 URL 형식입니다.");
      }
    }
  };

  const handleAddFile = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).map(file => ({
      id: uuidv4(),
      type: 'file' as const,
      name: file.name,
      mimeType: file.type,
      data: file,
    }));
    setAttachments(prev => [...prev, ...newFiles]);
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };


  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      {/* ... (헤더 부분은 변경 없음) ... */}
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
        </div>
      </header>

      {status && (
        <div className="banner mb-4">
          {status}
        </div>
      )}

      {/* ... (AI 주제 추천 섹션은 변경 없음) ... */}
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
        <RichTextEditor
          content={userContent}
          onChange={setUserContent}
        />
        
        <AttachmentPanel
          attachments={attachments}
          onAddLink={handleAddLink}
          onAddFile={handleAddFile}
          onRemoveAttachment={handleRemoveAttachment}
        />

        <div className="mt-4 text-right">
          <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors text-sm font-semibold" onClick={onSave}>이 내용으로 저장</button>
        </div>
      </section>

      {/* ... (고급 클리닝 설명 섹션은 변경 없음) ... */}
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
