
import React, { useRef } from 'react';
import { FilePlus } from 'lucide-react';
import { Note } from '../lib/types';
import { decryptJSON, EncryptedPayload } from '../lib/crypto'; // decryptJSON 임포트

// COMMENT: 노트 가져오기 버튼 컴포넌트
// 홈 화면에 플로팅 버튼 형태로 표시되며, 암호화되거나 일반 JSON 파일을 읽어 새 노트로 추가하는 기능을 담당합니다.

interface ImportButtonProps {
  onImport: (note: Partial<Note>) => Promise<void>;
}

// COMMENT: 주어진 데이터가 EncryptedPayload 형식인지 확인하는 타입 가드
function isEncryptedPayload(data: any): data is EncryptedPayload {
  return (
    data &&
    typeof data.v === 'number' &&
    data.alg === 'AES-GCM' &&
    typeof data.salt === 'string' &&
    typeof data.iv === 'string' &&
    typeof data.data === 'string'
  );
}

export default function ImportButton({ onImport }: ImportButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * COMMENT: 파일 선택 시 실행되는 핸들러
   * - 암호화된 파일과 일반 JSON 파일을 모두 처리합니다.
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

        let noteToImport: Partial<Note>;

        // COMMENT: 파일이 암호화된 형식인지 확인
        if (isEncryptedPayload(data)) {
          const passphrase = prompt('이 노트는 암호화되어 있습니다. 복호화 비밀번호를 입력하세요:');
          if (!passphrase) {
            alert('비밀번호가 입력되지 않아 가져오기를 취소합니다.');
            return;
          }
          try {
            // COMMENT: 입력받은 비밀번호로 복호화 시도
            const decryptedData = await decryptJSON<Partial<Note>>(data, passphrase);
            noteToImport = {
              title: decryptedData.title || '가져온 노트',
              content: decryptedData.content || '',
              topics: decryptedData.topics || [],
              labels: decryptedData.labels || [],
              sourceUrl: decryptedData.sourceUrl || '',
              sourceType: decryptedData.sourceType || 'web',
            };
          } catch (decryptError) {
            console.error('복호화 실패:', decryptError);
            alert('복호화에 실패했습니다. 비밀번호가 정확한지 확인해주세요.');
            return;
          }
        } else {
          // COMMENT: 일반 JSON 파일 처리 로직
          if (!data.content) {
            alert('가져오기 실패: JSON 파일에 "content" 필드가 필요합니다.');
            return;
          }
          noteToImport = {
            title: data.title || '가져온 노트',
            content: data.content,
            topics: data.topics || [],
            labels: data.labels || [],
            sourceUrl: data.sourceUrl || '',
            sourceType: data.sourceType || 'web',
          };
        }

        await onImport(noteToImport);
        alert('노트를 성공적으로 가져왔습니다!');

      } catch (error) {
        console.error('노트 가져오기 오류:', error);
        alert('노트를 가져오는 데 실패했습니다. 유효한 JSON 파일인지 확인해주세요.');
      } finally {
        if(fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />
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
