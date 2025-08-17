
import React, { useRef } from 'react';
import { FileUp } from 'lucide-react'; // 아이콘 변경
import { Note } from '../lib/types';
import { decryptJSON, EncryptedPayload } from '../lib/crypto';

interface ImportButtonProps {
  onImport: (note: Partial<Note>) => Promise<void>;
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

export default function ImportButton({ onImport }: ImportButtonProps) {
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

        let noteToImport: Partial<Note>;

        if (isEncryptedPayload(data)) {
          const passphrase = prompt('이 노트는 암호화되어 있습니다. 복호화 비밀번호를 입력하세요:');
          if (!passphrase) {
            alert('비밀번호가 입력되지 않아 가져오기를 취소합니다.');
            return;
          }
          try {
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
          if (!data.content) {
            alert('가져오기 실패: 파일에 "content" 필드가 필요합니다.');
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
