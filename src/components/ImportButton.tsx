import React, { useRef } from 'react';
import { FileUp } from 'lucide-react'; // 아이콘 변경
import { Note } from '../lib/types';
import { decryptJSON, EncryptedPayload } from '../lib/crypto';
import { addPlainNotesFromFile, addEncryptedNotesFromFile } from '../lib/backup'; // 🚀 GEMINI: addPlainNotesFromFile, addEncryptedNotesFromFile 임포트

interface ImportButtonProps {
  // onImport: (note: Partial<Note>) => Promise<void>; // 🚀 GEMINI: onImport prop 제거
}

function isEncryptedPayload(data: unknown): data is EncryptedPayload {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.v === 'number' &&
    obj.alg === 'AES-GCM' &&
    typeof obj.salt === 'string' &&
    typeof obj.iv === 'string' &&
    typeof obj.data === 'string'
  );
}

export default function ImportButton(/* 🚀 GEMINI: onImport prop 제거 */) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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

        let importedCount: number; // 🚀 GEMINI: 가져온 노트 수를 저장할 변수

        if (isEncryptedPayload(data)) {
          const passphrase = prompt('이 노트는 암호화되어 있습니다. 복호화 비밀번호를 입력하세요:');
          if (!passphrase) {
            alert('비밀번호가 입력되지 않아 가져오기를 취소합니다.');
            return;
          }
          importedCount = await addEncryptedNotesFromFile(file, passphrase); // 🚀 GEMINI: addEncryptedNotesFromFile 호출
        } else {
          importedCount = await addPlainNotesFromFile(file); // 🚀 GEMINI: addPlainNotesFromFile 호출
        }

        alert(`${importedCount}개의 노트를 성공적으로 가져왔습니다!`);
        // 🚀 GEMINI: 페이지 새로고침하여 변경사항 반영
        location.reload();

      } catch (error) {
        console.error('노트 가져오기 오류:', error);
        alert('노트를 가져오는 데 실패했습니다. 유효한 파일인지 확인해주세요.');
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
        accept=".json,.txt" // .txt 파일도 허용
        className="hidden"
      />
      <button
        onClick={handleClick}
        className="z-40 inline-flex items-center justify-center w-14 h-14 rounded-full shadow-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 active:scale-95 transition-transform"
        aria-label="노트 가져오기"
        title="노트 가져오기"
      >
        <FileUp className="h-6 w-6" />
      </button>
    </>
  );
}
