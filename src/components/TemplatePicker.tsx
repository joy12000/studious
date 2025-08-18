import React, { useState, useMemo } from "react";
import { Edit, Trash2, Plus } from "lucide-react";
import { useTemplates, UserTemplate, renderTemplate } from "../lib/useTemplates";

// ## 타입 정의
type Props = {
  activeTemplates: string[];
  onTemplateToggle: (id: string) => void;
};

// ## 자식 컴포넌트
const TemplateItem = ({ t, isChecked, onToggle, onEdit, onRemove, isUserTemplate }: {
  t: UserTemplate;
  isChecked: boolean;
  onToggle: (id:string) => void;
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

// ## 메인 컴포넌트
export default function TemplatePicker({ activeTemplates, onTemplateToggle }: Props) {
  const {
    defaultTemplates,
    userTemplates,
    addTemplate,
    updateTemplate,
    removeTemplate,
  } = useTemplates();

  const [isOpen, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserTemplate | null>(null);

  const handleSave = (template: UserTemplate) => {
    if (userTemplates.some(t => t.id === template.id)) {
      updateTemplate(template);
    } else {
      addTemplate(template);
    }
    setEditing(null);
  };

  const handleRemove = (id: string) => {
    if (window.confirm("정말 이 템플릿을 삭제하시겠어요?")) {
      removeTemplate(id);
    }
  };

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
          {defaultTemplates.map(t => (
            <TemplateItem
              key={t.id}
              t={t}
              isChecked={activeTemplates.includes(t.id)}
              onToggle={onTemplateToggle}
              isUserTemplate={false}
            />
          ))}

          <div className="px-2 py-1 text-xs text-slate-500 dark:text-slate-400 mt-2">내 템플릿</div>
          {userTemplates.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">아직 없어요. 아래에서 추가하세요.</div>
          ) : (
            userTemplates.map(t => (
              <TemplateItem
                key={t.id}
                t={t}
                isChecked={activeTemplates.includes(t.id)}
                onToggle={onTemplateToggle}
                onEdit={setEditing}
                onRemove={handleRemove}
                isUserTemplate={true}
              />
            ))
          )}
          <div className="p-2 mt-2 border-t border-slate-200 dark:border-slate-700">
            <button 
              className="w-full flex items-center justify-center gap-2 text-center px-3 py-2 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800 text-sm" 
              onClick={() => setEditing({ id: '', name: "", content: "" })}
            >
              <Plus className="h-4 w-4" /> 새 템플릿 추가
            </button>
          </div>
        </div>
      )}

      {editing && (
        <TemplateEditorModal
          template={editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}


// ## 템플릿 에디터 모달 컴포넌트
function TemplateEditorModal({ template, onSave, onClose }: {
  template: UserTemplate | { id: '', name: string, content: string };
  onSave: (t: UserTemplate) => void;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(template);
  const isNew = !template.id;

  const previewContent = useMemo(() => {
    // 미리보기에서는 템플릿 구분선 없이 순수 내용만 렌더링
    const tempTemplate = { ...current, content: current.content };
    const rendered = renderTemplate(tempTemplate);
    // --- 구분선과 헤더 제거
    return rendered.split('---')[2]?.trim() || '';
  }, [current.content]);

  const handleSave = () => {
    if (!current.name.trim() || !current.content.trim()) {
      alert("템플릿 이름과 내용을 모두 입력해주세요.");
      return;
    }
    onSave(current as UserTemplate);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="text-xl font-semibold mb-4">{isNew ? "새 템플릿 만들기" : "템플릿 수정"}</div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Editor Column */}
          <div>
            <label className="block text-sm font-medium mb-1">이름</label>
            <input 
              className="w-full mb-4 px-3 py-2 rounded-xl border bg-white dark:bg-slate-900" 
              value={current.name} 
              onChange={e => setCurrent({ ...current, name: e.target.value })} 
              placeholder="예: 주간 회의록" 
            />
            
            <label className="block text-sm font-medium mb-1">
              내용
              <span className="text-xs text-slate-500 ml-2">
                (변수: <code>{'{{date}}'}</code>, <code>{'{{time}}'}</code>)
              </span>
            </label>
            <textarea 
              className="w-full h-64 px-3 py-2 rounded-xl border font-mono text-sm bg-white dark:bg-slate-900 resize-y" 
              value={current.content} 
              onChange={e => setCurrent({ ...current, content: e.target.value })} 
              placeholder="## {{date}} 회의" 
            />
          </div>

          {/* Preview Column */}
          <div>
            <label className="block text-sm font-medium mb-1">실시간 미리보기</label>
            <div 
              className="w-full h-[calc(100%-2.25rem)] px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800/50 overflow-auto prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: previewContent.replace(/\n/g, '<br/>') }}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button className="px-4 py-2 rounded-xl border hover:bg-slate-50 dark:hover:bg-slate-800" onClick={onClose}>
            취소
          </button>
          <button 
            className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50" 
            disabled={!current.name.trim() || !current.content.trim()} 
            onClick={handleSave}
          >
            {isNew ? '추가' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}