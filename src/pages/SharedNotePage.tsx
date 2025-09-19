
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Note, ExportedData } from '../lib/types'; // ExportedData 타입 임포트
import { useNotes } from '../lib/useNotes'; // useNotes 훅 임포트

// DECRYPT_VIEW를 NOTE_VIEW로 변경 (더 이상 복호화하지 않으므로)
function NoteView({ note, onSave }: { note: Partial<Note>, onSave: () => void }) {
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

// ... (ErrorView, LoadingView는 변경 없음) ...
function ErrorView({ message }: { message: string }) {
  return (
    <div className="p-4 text-center">
      <h1 className="text-2xl font-bold text-destructive mb-2">오류</h1>
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
function LoadingView({ text }: { text: string }) {
  return <div className="p-4 text-center text-muted-foreground">{text}</div>;
}


export default function SharedNotePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addNote } = useNotes();
  
  const [noteToImport, setNoteToImport] = useState<Partial<Note> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'loading' | 'note' | 'error'>('loading');

  useEffect(() => {
    const loadContent = async () => {
      try {
        const sharedContent = location.state?.sharedContent;
        if (!sharedContent) {
          setError('공유된 노트 내용이 없습니다.');
          setView('error');
          return;
        }
        
        const data = JSON.parse(sharedContent) as ExportedData;
        if (data?.version !== 1 || !Array.isArray(data.notes) || data.notes.length === 0) {
          throw new Error('유효하지 않은 노트 파일 형식입니다.');
        }

        // 공유된 파일에는 노트가 하나만 있다고 가정
        setNoteToImport(data.notes[0]);
        setView('note');

      } catch (err) {
        console.error('Failed to load shared content:', err);
        setError('공유된 파일을 읽는 데 실패했습니다. 파일 형식이 올바른지 확인하세요.');
        setView('error');
      }
    };
    loadContent();
  }, [location.state]);

  const handleSaveNote = async () => {
    if (!noteToImport) return;
    try {
      // useNotes 훅의 addNote 함수를 사용해 저장
      await addNote(noteToImport);
      alert('노트가 성공적으로 저장되었습니다.');
      navigate('/'); // 저장 후 홈으로 이동
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
  if (view === 'note' && noteToImport) {
    return <NoteView note={noteToImport} onSave={handleSaveNote} />;
  }

  return <ErrorView message="알 수 없는 오류가 발생했습니다." />;
}
