import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNotes } from "../lib/useNotes";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, Youtube, ArrowRight, File, Calendar, Bot } from "lucide-react";

// 진행 메시지를 표시하는 오버레이 컴포넌트
function LoadingOverlay({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-lg bg-card p-8 text-card-foreground shadow-xl">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-medium">{message}</p>
        <p className="text-sm text-muted-foreground">잠시만 기다려주세요...</p>
      </div>
    </div>
  );
}

const HEADLINES = [
  "어떤 것을 학습할까요?",
  "오늘 탐색할 지식은 무엇인가요?",
  "학습 자료를 업로드하거나 AI와 대화해보세요.",
];

type InputMode = 'youtube' | 'review' | 'schedule';

export default function HomePage() {
  const { addNote, addNoteFromReview, addScheduleFromImage, allSubjects } = useNotes();
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<InputMode>('youtube'); // 기본 모드를 'youtube'로 변경
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [headline, setHeadline] = useState(HEADLINES[0]);

  useEffect(() => {
    setHeadline(HEADLINES[Math.floor(Math.random() * HEADLINES.length)]);
  }, []);

  useEffect(() => {
    if (location.state?.focusInput && mode === 'youtube') {
      inputRef.current?.focus();
    }
  }, [location.state, mode]);

  const handleSave = async () => {
    setError(null);
    if (mode === 'youtube') {
      if (!youtubeUrl.trim()) {
        setError("유튜브 URL을 입력해주세요.");
        return;
      }
      if (!youtubeUrl.includes("youtube.com") && !youtubeUrl.includes("youtu.be")) {
        setError("유효한 유튜브 URL이 아닙니다.");
        return;
      }
      setProgressMessage("요약을 준비하는 중...");
      await addNote({
        youtubeUrl,
        onProgress: setProgressMessage,
        onComplete: (newNote) => {
          setProgressMessage(null);
          navigate(`/note/${newNote.id}`);
        },
        onError: (err) => {
          setError(err);
          setProgressMessage(null);
        },
      });
    } else if (files.length > 0) {
      if (mode === 'review') {
        setProgressMessage("복습 노트를 생성하는 중...");
        await addNoteFromReview({
          aiConversationText: '', // This needs to be implemented
          files,
          subjects: allSubjects || [],
          onProgress: setProgressMessage,
          onComplete: (newNote, newQuiz) => {
            setProgressMessage(null);
            navigate(`/note/${newNote.id}`);
          },
          onError: (err) => {
            setError(err);
            setProgressMessage(null);
          },
        });
      } else if (mode === 'schedule') {
        setProgressMessage("시간표를 분석하는 중...");
        await addScheduleFromImage({
          file: files[0], // Schedule still uses a single file
          onProgress: setProgressMessage,
          onComplete: (events) => {
            setProgressMessage(null);
            navigate(`/schedule`);
          },
          onError: (err) => {
            setError(err);
            setProgressMessage(null);
          },
        });
      }
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prevFiles => [...prevFiles, ...acceptedFiles]);
  }, []);

  const isLoading = progressMessage !== null;

  return (
    <>
      {isLoading && <LoadingOverlay message={progressMessage as string} />}
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-3xl text-center">
          
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium tracking-tight text-foreground mb-8">
            {headline}
          </h1>

          <div className="bg-card p-2 rounded-full flex items-center justify-center space-x-1 sm:space-x-2 mb-4">
            <button onClick={() => navigate('/chat')} className={`px-3 sm:px-4 py-2 rounded-full text-sm font-semibold transition-colors bg-transparent text-muted-foreground hover:bg-muted`}><Bot className="inline-block mr-1.5 h-4 w-4"/>AI 채팅</button>
            <button onClick={() => setMode('youtube')} className={`px-3 sm:px-4 py-2 rounded-full text-sm font-semibold transition-colors ${mode === 'youtube' ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted'}`}><Youtube className="inline-block mr-1.5 h-4 w-4"/>유튜브</button>
            <button onClick={() => setMode('review')} className={`px-3 sm:px-4 py-2 rounded-full text-sm font-semibold transition-colors ${mode === 'review' ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted'}`}><File className="inline-block mr-1.5 h-4 w-4"/>학습자료</button>
            <button onClick={() => setMode('schedule')} className={`px-3 sm:px-4 py-2 rounded-full text-sm font-semibold transition-colors ${mode === 'schedule' ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted'}`}><Calendar className="inline-block mr-1.5 h-4 w-4"/>시간표</button>
          </div>

          <div className="relative mt-6" style={{ minHeight: '60vh' }}>
            {mode === 'youtube' ? (
              <div className="relative flex items-center w-full">
                <Youtube className="absolute left-6 h-6 w-6 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  className="w-full pl-16 pr-32 py-3 text-lg border bg-card rounded-full shadow-md focus:ring-2 focus:ring-primary focus:border-transparent focus:shadow-lg transition-all disabled:opacity-70"
                  placeholder="유튜브 링크 붙여넣기"
                  disabled={isLoading}
                />
                <button 
                  onClick={handleSave} 
                  disabled={isLoading}
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center bg-primary text-primary-foreground h-11 w-11 rounded-full font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all duration-300 ${youtubeUrl.trim() ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
                </button>
              </div>
            ) : (
              <div className="w-full">
                <div 
                  className="w-full min-h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors p-4"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  {files.length > 0 ? (
                    <ul className="list-disc pl-5 text-left">
                      {files.map((f, i) => <li key={i} className="text-sm">{f.name}</li>)}
                    </ul>
                  ) : (
                    <p>여기에 파일을 드래그 앤 드롭하거나 클릭하여 업로드하세요.</p>
                  )}
                  <input id="file-upload" type="file" multiple className="hidden" onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])} />
                </div>
                {files.length > 0 && (
                  <div className="mt-4 text-center">
                    <button 
                      onClick={handleSave} 
                      disabled={isLoading}
                      className={`inline-flex items-center justify-center bg-primary text-primary-foreground h-12 px-6 rounded-full font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all duration-300`}
                    >
                      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><ArrowRight className="h-5 w-5 mr-2" />생성하기</>}
                    </button>
                  </div>
                )}
              </div>
            )}
            {error && <p className="text-destructive text-sm mt-4 text-center">{error}</p>}
          </div>

        </div>
      </div>
    </>
  );
}