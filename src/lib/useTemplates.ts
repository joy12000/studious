import { useState, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

// ## 타입 정의
export type UserTemplate = {
  id: string;
  name: string;
  content: string;
};

// ## 상수 정의
const TEMPLATES_LS_KEY = "userTemplates";

const defaultTemplates: UserTemplate[] = [
  { id: "default-meeting", name: "회의 메모", content: "## 안건\n- \n\n## 핵심 결론\n- \n\n## 할 일(To-Do)\n- [ ] 담당자:  / 마감: \n\n## 참고\n- \n" },
  { id: "default-reading", name: "독서 노트", content: "## 책/출처\n- \n\n## 인상 깊은 문장\n> \n\n## 요약\n- \n\n## 적용 아이디어\n- \n" },
  { id: "default-idea", name: "아이디어 스케치", content: "## 한 줄\n- \n\n## 문제/고객\n- \n\n## 해결 아이디어\n- \n\n## 다음 실험\n- 가설: \n- 지표: \n- 마감: \n" }
];

// ## 로컬 스토리지 헬퍼 함수
function loadUserTemplatesFromStorage(): UserTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // GEMINI: 타입 체크 강화
      if (Array.isArray(parsed)) {
        return parsed.filter(t => t && typeof t.id === 'string' && typeof t.name === 'string' && typeof t.content === 'string');
      }
    }
  } catch (error) {
    console.error("Failed to load user templates from localStorage", error);
  }
  // GEMINI: 최초 로드 시 기본 템플릿 복사본을 사용자 템플릿으로 저장
  const initialUserTemplates = defaultTemplates.map(t => ({...t, id: `user-${t.id}`}));
  saveUserTemplatesToStorage(initialUserTemplates);
  return initialUserTemplates;
}

function saveUserTemplatesToStorage(templates: UserTemplate[]) {
  try {
    localStorage.setItem(TEMPLATES_LS_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error("Failed to save user templates to localStorage", error);
  }
}

// ## 템플릿 렌더링 헬퍼 함수

// GEMINI: 실시간 미리보기 및 변수 치환 전용 함수
export function renderTemplateContent(content: string): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5);
  
  return content
    .replace(/\{\{date\}\}/g, date)
    .replace(/\{\{time\}\}/g, time);
}

// GEMINI: 본문 삽입용 최종 템플릿 렌더링 함수 (고유 ID 포함)
export function renderTemplateForInsertion(template: UserTemplate): { blockId: string, renderedContent: string } {
  const blockId = `template-block-${template.id}-${Date.now()}`;
  const filledContent = renderTemplateContent(template.content);
  
  const renderedContent = `

<!-- ${blockId} -->
---
### 템플릿: ${template.name}
${filledContent}
---
<!-- /${blockId} -->`;
  
  return { blockId, renderedContent };
}


// ## 메인 커스텀 훅: useTemplates
export function useTemplates() {
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>(loadUserTemplatesFromStorage);

  // GEMINI: allTemplates를 userTemplates로 단일화. 기본 템플릿은 초기값으로만 활용.
  const allTemplates = useMemo<UserTemplate[]>(() => {
    return userTemplates;
  }, [userTemplates]);

  const addTemplate = useCallback((templateData: { name: string; content: string }) => {
    const newTemplate: UserTemplate = {
      id: uuidv4(),
      ...templateData,
    };
    setUserTemplates(prev => {
      const updated = [...prev, newTemplate];
      saveUserTemplatesToStorage(updated);
      return updated;
    });
  }, []);

  const updateTemplate = useCallback((updatedTemplate: UserTemplate) => {
    setUserTemplates(prev => {
      const updated = prev.map(t => t.id === updatedTemplate.id ? updatedTemplate : t);
      saveUserTemplatesToStorage(updated);
      return updated;
    });
  }, []);

  const removeTemplate = useCallback((id: string) => {
    setUserTemplates(prev => {
      const updated = prev.filter(t => t.id !== id);
      saveUserTemplatesToStorage(updated);
      return updated;
    });
  }, []);
  
  const getTemplateById = useCallback((id: string): UserTemplate | undefined => {
    return allTemplates.find(t => t.id === id);
  }, [allTemplates]);

  return {
    // GEMINI: defaultTemplates는 더 이상 외부로 노출할 필요 없음
    userTemplates,
    allTemplates,
    addTemplate,
    updateTemplate,
    removeTemplate,
    getTemplateById,
  };
}
