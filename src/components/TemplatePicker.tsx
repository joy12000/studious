import React, { useMemo, useState } from "react";
import { Check, Edit, Trash2, Plus } from "lucide-react";

export type UserTemplate = { id: string; name: string; content: string };
type Props = {
  activeTemplates: string[];
  onTemplateToggle: (id: string) => void;
};

const LS_KEY = "userTemplates";

function loadTemplates(): UserTemplate[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr;
  } catch (err) {
    console.error('Failed to load templates:', err);
  }
  return [];
}
function saveTemplates(data: UserTemplate[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save templates:', err);
  }
}

const defaults: UserTemplate[] = [
  { id: "default-meeting", name: "회의 메모", content: "## 안건\n- \n\n## 핵심 결론\n- \n\n## 할 일(To-Do)\n- [ ] 담당자:  / 마감: \n\n## 참고\n- \n" },
  { id: "default-reading", name: "독서 노트", content: "## 책/출처\n- \n\n## 인상 깊은 문장\n> \n\n## 요약\n- \n\n## 적용 아이디어\n- \n" },
  { id: "default-idea", name: "아이디어 스케치", content: "## 한 줄\n- \n\n## 문제/고객\n- \n\n## 해결 아이디어\n- \n\n## 다음 실험\n- 가설: \n- 지표: \n- 마감: \n" }
];

// GEMINI: TemplateItem 컴포넌트 분리
const TemplateItem = ({ t, isChecked, onToggle, onEdit, onRemove, isUserTemplate }: {
  t: UserTemplate;
  isChecked: boolean;
  onToggle: (id: string) => void;
  onEdit?: (t: UserTemplate) => void;
  onRemove?: (id: string) => void;
  isUserTemplate: boolean;
}) => (
  <div key={t.id} className="flex items-center gap-2 px-2 py-1 group">
    <label className="flex-1 flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
      <input
        type="checkbox"
        className="w-4 h-4 rounded text-primary focus:ring-primary/50 border-muted"
        checked={isChecked}
        onChange={() => onToggle(t.id)}
      />
      <span className="flex-1 text-left">{t.name}</span>
    </label>
    {isUserTemplate && onEdit && onRemove && (
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
        <button className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => onEdit(t)} aria-label="수정">
          <Edit className="h-4 w-4" />
        </button>
        <button className="p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-900/40 text-red-600" onClick={() => onRemove(t.id)} aria-label="삭제">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    )}
  </div>
);


export default function TemplatePicker({ activeTemplates, onTemplateToggle }: Props) {
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>(loadTemplates());
  const [isOpen, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserTemplate | null>(null);

  const allTemplates = useMemo(() => [...defaults, ...userTemplates], [userTemplates]);

  function addOrUpdate(t: UserTemplate) { setUserTemplates(prev => { const next = prev.some(x => x.id === t.id) ? prev.map(x => x.id === t.id ? t : x) : [...prev, t]; saveTemplates(next); return next; }); setEditing(null); }
  function remove(id: string) { setUserTemplates(prev => { const next = prev.filter(x => x.id !== id); saveTemplates(next); return next; }); }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="px-3 py-2 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors text-sm"
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
          className="absolute z-20 mt-2 w-72 max-h-80 overflow-auto rounded-2xl border bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 shadow-lg p-2"
        >
          <div className="px-2 py-1 text-xs text-slate-500 dark:text-slate-400">기본 템플릿</div>
          {defaults.map(t => (
            <TemplateItem
              key={t.id}
              t={t}
              isChecked={activeTemplates.includes(t.id)}
              onToggle={onTemplateToggle}
              isUserTemplate={false}
            />
          ))}

          <div className="px-2 py-1 text-xs text-slate-500 dark:text-slate-400 mt-2">내 템플릿</div>
          {userTemplates.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">아직 없어요. 아래에서 추가하세요.</div>
          )}
          {userTemplates.map(t => (
            <TemplateItem
              key={t.id}
              t={t}
              isChecked={activeTemplates.includes(t.id)}
              onToggle={onTemplateToggle}
              onEdit={setEditing}
              onRemove={remove}
              isUserTemplate={true}
            />
          ))}
          <div className="p-2 mt-2 border-t border-slate-200 dark:border-slate-700">
            <button className="w-full flex items-center justify-center gap-2 text-center px-3 py-2 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800 text-sm" onClick={() => setEditing({ id: crypto.randomUUID(), name: "", content: "" })}>
              <Plus className="h-4 w-4" /> 새 템플릿 추가
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-lg font-semibold mb-2">{editing.name ? "템플릿 수정" : "새 템플릿"}</div>
            <label className="block text-sm mb-1">이름</label>
            <input className="w-full mb-3 px-3 py-2 rounded-xl border bg-white dark:bg-slate-900" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="예: 회의 템플릿 v2" />
            <label className="block text-sm mb-1">
              내용{" "}
              <span className="text-xs text-slate-500">
                (변수: <code>{'{{date}}'}</code>, <code>{'{{time}}'}</code>)
              </span>
            </label>
            <textarea className="w-full h-56 mb-4 px-3 py-2 rounded-xl border font-mono text-sm bg-white dark:bg-slate-900" value={editing.content} onChange={e => setEditing({ ...editing, content: e.target.value })} placeholder="# 제목 — {{date}}" />
            <div className="flex justify-between gap-2">
              <div className="text-xs text-slate-500">미리보기는 삽입 시 적용돼요.</div>
              <div className="flex gap-2">
                <button className="px-3 py-2 rounded-xl border hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => setEditing(null)}>닫기</button>
                <button className="px-3 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50" disabled={!editing.name || !editing.content} onClick={() => addOrUpdate(editing)}>저장</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}