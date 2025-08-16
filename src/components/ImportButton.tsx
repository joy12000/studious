
import React, { useRef } from 'react';
import { FilePlus } from 'lucide-react';
import { Note } from '../lib/types';

// COMMENT: 노트 가져오기 버튼 컴포넌트
// 홈 화면에 플로팅 버튼 형태로 표시되며, JSON 파일을 읽어 새 노트로 추가하는 기능을 담당합니다.

interface ImportButtonProps {
  // onImport: 노트를 추가하는 함수. useNotes 훅의 addNote 함수가 전달됩니다.
  onImport: (note: Partial<Note>) => Promise<void>;
}

export default function ImportButton({ onImport }: ImportButtonProps) {
  // COMMENT: 숨겨진 file input 엘리먼트에 접근하기 위한 ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * COMMENT: 파일 선택 시 실행되는 핸들러
   * - 선택된 파일의 유효성을 검사합니다.
   * - FileReader를 사용해 파일 내용을 텍스트로 읽습니다.
   * - 읽기가 완료되면 onload 핸들러가 실행됩니다.
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          throw new Error('파일을 읽는 데 실패했습니다.');
        }
        const data = JSON.parse(text);

        // COMMENT: 가져온 데이터에 content 필드가 있는지 최소한의 유효성 검사를 수행합니다.
        if (!data.content) {
          alert('가져오기 실패: JSON 파일에 "content" 필드가 필요합니다.');
          return;
        }

        // COMMENT: 새 노트 객체를 생성합니다. title이 없으면 기본값을 사용합니다.
        const noteToImport: Partial<Note> = {
          title: data.title || '가져온 노트',
          content: data.content,
          topics: data.topics || [],
          labels: data.labels || [],
          sourceUrl: data.sourceUrl || '',
          sourceType: data.sourceType || 'web',
        };

        await onImport(noteToImport);
        alert('노트를 성공적으로 가져왔습니다!');

      } catch (error) {
        console.error('노트 가져오기 오류:', error);
        alert('노트를 가져오는 데 실패했습니다. 유효한 JSON 파일인지 확인해주세요.');
      } finally {
        // COMMENT: 같은 파일을 다시 선택해도 onChange 이벤트가 발생하도록 값을 초기화합니다.
        if(fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  /**
   * COMMENT: 버튼 클릭 시 숨겨진 file input을 클릭하여 파일 선택창을 엽니다.
   */
  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      {/* COMMENT: 실제 파일 선택 로직을 처리하는 숨겨진 input 엘리먼트 */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />
      {/* COMMENT: 사용자에게 보여지는 플로팅 액션 버튼 */}
      <button
        onClick={handleClick}
        className="fixed bottom-28 right-6 bg-secondary text-secondary-foreground rounded-full p-4 shadow-lg hover:bg-secondary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-transform duration-200 ease-in-out hover:scale-105"
        aria-label="노트 가져오기"
        title="노트 가져오기"
      >
        <FilePlus className="h-6 w-6" />
      </button>
    </>
  );
}
