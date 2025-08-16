
import { useEffect, useState } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { decryptJSON, EncryptedPayload, b64decode } from '../lib/crypto';
import { Note } from '../lib/types';
import { useNotes } from '../lib/useNotes';
import { createNote } from '../lib/note';

// DECRYPT_VIEW: 복호화된 내용을 보여주는 뷰 컴포넌트
function DecryptView({ note, onSave }: { note: Partial<Note>, onSave: () => void }) {
  const handleCopy = () => {
    if (note.content) {
      navigator.clipboard.writeText(note.content);
      alert('노트 내용이 복사되었습니다.');
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">공유된 노트 가져오기</h1>
      <p className="text-muted-foreground mb-4">아래 노트 내용을 확인하고 저장하세요.</p>
      
      <div className="bg-card border rounded-lg p-4 mb-4">
        <h2 className="text-xl font-semibold mb-2">{note.title}</h2>
        <pre className="bg-muted p-4 rounded-md whitespace-pre-wrap break-words text-card-foreground">
          {note.content}
        </pre>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onSave}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-4 rounded-lg flex-1"
        >
          내 노트에 저장
        </button>
        <button
          onClick={handleCopy}
          className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold py-2 px-4 rounded-lg"
        >
          내용만 복사
        </button>
      </div>
    </div>
  );
}

// ERROR_VIEW: 오류 메시지를 보여주는 뷰 컴포넌트
function ErrorView({ message }: { message: string }) {
  return (
    <div className="p-4 text-center">
      <h1 className="text-2xl font-bold text-destructive mb-2">오류</h1>
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

// LOADING_VIEW: 로딩 상태를 보여주는 뷰 컴포넌트
function LoadingView({ text }: { text: string }) {
  return <div className="p-4 text-center text-muted-foreground">{text}</div>;
}

// PASSPHRASE_VIEW: 비밀번호 입력을 요청하는 뷰 컴포넌트
function PassphraseView({ onConfirm }: { onConfirm: (pass: string) => void }) {
  const [pass, setPass] = useState('');

  const handleSubmit = () => {
    if (pass) onConfirm(pass);
  };

  return (
    <div className="p-4 max-w-sm mx-auto">
      <h1 className="text-2xl font-bold mb-2">비밀번호 입력</h1>
      <p className="text-muted-foreground mb-4">공유받은 4자리 비밀번호를 입력하세요.</p>
      <input
        type="tel"
        maxLength={4}
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        className="w-full text-center text-3xl tracking-[1em] font-mono border-2 border-border rounded-lg p-3 focus:ring-2 focus:ring-ring"
        placeholder="••••"
      />
      <button
        onClick={handleSubmit}
        className="w-full mt-4 bg-primary text-primary-foreground font-bold py-3 rounded-lg hover:bg-primary/90"
      >
        복호화
      </button>
    </div>
  );
}


export default function SharedNotePage() {
  const location = useLocation();
  const { addNote } = useNotes();
  
  const [encryptedPayload, setEncryptedPayload] = useState<EncryptedPayload | null>(null);
  const [decryptedNote, setDecryptedNote] = useState<Partial<Note> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'loading' | 'passphrase' | 'decrypt' | 'error'>('loading');

  useEffect(() => {
    const loadContent = async () => {
      try {
        const sharedContent = location.state?.sharedContent;
        if (!sharedContent) {
          setError('공유된 노트 내용이 없습니다.');
          setView('error');
          return;
        }
        
        const payload = JSON.parse(sharedContent);
        setEncryptedPayload(payload);
        setView('passphrase');

      } catch (err) {
        console.error('Failed to load shared content:', err);
        setError('공유된 파일이 유효하지 않습니다.');
        setView('error');
      }
    };
    loadContent();
  }, [location.state]);

  const handleDecrypt = async (passphrase: string) => {
    if (!encryptedPayload) return;
    
    setView('loading');
    try {
      const decrypted = await decryptJSON<Note>(encryptedPayload, passphrase);
      if (!decrypted.content) {
        throw new Error('복호화된 데이터에 내용이 없습니다.');
      }
      setDecryptedNote(decrypted);
      setView('decrypt');
    } catch (err) {
      console.error('Decryption failed:', err);
      setError('복호화에 실패했습니다. 비밀번호가 올바른지 확인하세요.');
      setView('passphrase'); // Allow retry
    }
  };

  const handleSaveNote = async () => {
    if (!decryptedNote || !decryptedNote.content) return;
    try {
      await createNote({
        content: decryptedNote.content,
        title: decryptedNote.title,
        sourceUrl: decryptedNote.sourceUrl,
        sourceType: decryptedNote.sourceType,
      });
      alert('노트가 성공적으로 저장되었습니다.');
    } catch (err) {
      console.error('Failed to save note:', err);
      alert('노트를 저장하는 데 실패했습니다.');
    }
  };

  if (view === 'loading') {
    return <LoadingView text="노트 내용 확인 중..." />;
  }
  if (view === 'error') {
    return <ErrorView message={error!} />;
  }
  if (view === 'passphrase') {
    return <PassphraseView onConfirm={handleDecrypt} />;
  }
  if (view === 'decrypt' && decryptedNote) {
    return <DecryptView note={decryptedNote} onSave={handleSaveNote} />;
  }

  return <ErrorView message="알 수 없는 오류가 발생했습니다." />;
}
