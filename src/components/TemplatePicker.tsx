import React, { useMemo, useState } from "react";

export type UserTemplate = { id: string; name: string; content: string };

type Props = {
  onInsert: (content: string) => void;
};

const LS_KEY = "userTemplates";

function nowISODate() {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function renderTemplate(src: string) {
  return src
    .replace(/\{\{date\}\}/g, nowISODate())
    .replace(/\{\{time\}\}/g, new Date().toLocaleTimeString());
}

function loadTemplates(): UserTemplate[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return arr.filter(x => x && typeof x.id === "string" && typeof x.name === "string" && typeof x.content === "string");
    }
  } catch {}
  return [];
}

function saveTemplates(data: UserTemplate[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(Array.isArray(data) ? data : []));
  } catch {}
}

const defaults: UserTemplate[] = [
  { id: "default-meeting", name: "회의 메모", content: "# 회의 메모 — {{date}}\n\n## 안건\n- \n\n## 핵심 결론\n- \n\n## 할 일(To-Do)\n- [ ] 담당자:  / 마감: \n\n## 참고\n- \n" },
  { id: "default-reading", name: "독서 노트", content: "# 독서 노트 — {{date}}\n\n## 책/출처\n- \n\n## 인상 깊은 문장\n> \n\n## 요약\n- \n\n## 적용 아이디어\n- \n" },
  { id: "default-idea", name: "아이디어 스케치", content: "# 아이디어 — {{date}}\n\n## 한 줄\n- \n\n## 문제/고객\n- \n\n## 해결 아이디어\n- \n\n## 다음 실험\n- 가설: \n- 지표: \n- 마감: \n" }
];

export default function TemplatePicker({ onInsert }: Props) {
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>(loadTemplates());
  const [isOpen, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserTemplate | null>(null);

  const safeUserTemplates = Array.isArray(userTemplates) ? userTemplates : [];
  const all = useMemo(() => [...defaults, ...safeUserTemplates], [safeUserTemplates]);

  function addOrUpdate(t: UserTemplate) {
    setUserTemplates(prev => {
      const base = Array.isArray(prev) ? prev : [];
      const next = base.some(x => x.id === t.id)
        ? base.map(x => (x.id === t.id ? t : x))
        : [...base, t];
      saveTemplates(next);
      return next;
    });
    setEditing(null);
  }

  function remove(id: string) {
    setUserTemplates(prev => {
      const base = Array.isArray(prev) ? prev : [];
      const next = base.filter(x => x.id != id);
      saveTemplates(next);
      return next;
    });
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="px-3 py-2 rounded-xl border shadow-sm text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        템플릿
      </button>

      {isOpen && (
        <div
          role="menu"
          tabIndex={-1}
          className="absolute z-20 mt-2 w-72 max-h-80 overflow-auto rounded-2xl border bg-white dark:bg-gray-900 shadow-lg p-2"
        >
          <div className="px-2 py-1 text-xs text-gray-500">기본 템플릿</div>
          {defaults.map(t => (
            <button
              key={t.id}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => {
                onInsert(renderTemplate(t.content));
                setOpen(false);
              }}
            >
              {t.name}
            </button>
          ))}

          <div className="px-2 py-1 text-xs text-gray-500 mt-2">내 템플릿</div>
          {safeUserTemplates.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400">아직 없어요. 아래에서 추가하세요.</div>
          )}
          {safeUserTemplates.map(t => (
            <div key={t.id} className="flex items-center gap-2 px-2 py-1">
              <button
                className="flex-1 text-left px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => {
                  onInsert(renderTemplate(t.content));
                  setOpen(false);
                }}
              >
                {t.name}
              </button>
              <button
                className="text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => setEditing(t)}
              >
                수정
              </button>
              <button
                className="text-xs px-2 py-1 rounded hover:bg-red-50 text-red-600"
                onClick={() => remove(t.id)}
              >
                삭제
              </button>
            </div>
          ))}
          <div className="p-2">
            <button
              className="w-full text-center px-3 py-2 rounded-xl border hover:bg-gray-50 dark:hover:bg-gray-800"
              onClick={() => setEditing({ id: crypto.randomUUID(), name: "", content: "" })}
            >
              + 새 템플릿 추가
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-xl rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-lg font-semibold mb-2">
              {editing.name ? "템플릿 수정" : "새 템플릿"}
            </div>
            <label className="block text-sm mb-1">이름</label>
            <input
              className="w-full mb-3 px-3 py-2 rounded-xl border bg-transparent"
              value={editing.name}
              onChange={e => setEditing({ ...editing, name: e.target.value })}
              placeholder="예: 회의 템플릿 v2"
            />
            <label className="block text-sm mb-1">
              내용{" "}
              <span className="text-xs text-gray-500">
                (변수: <code>{'{{date}}'}</code>, <code>{'{{time}}'}</code>)
              </span>
            </label>
            <textarea
              className="w-full h-56 mb-4 px-3 py-2 rounded-xl border font-mono text-sm bg-transparent"
              value={editing.content}
              onChange={e => setEditing({ ...editing, content: e.target.value })}
              placeholder="# 제목 — {{date}}"
            />
            <div className="flex justify-between gap-2">
              <div className="text-xs text-gray-500">미리보기는 삽입 시 적용돼요.</div>
              <div className="flex gap-2">
                <button
                  className="px-3 py-2 rounded-xl border hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => setEditing(null)}
                >
                  닫기
                </button>
                <button
                  className="px-3 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50"
                  disabled={!editing.name || !editing.content}
                  onClick={() => addOrUpdate(editing)}
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
