import React, { useState, useEffect } from "react";
import { useNotes } from "../lib/useNotes";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, Youtube, ArrowRight, File, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const LoadingOverlay = ({ message }: { message: string }) => (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="mt-4 text-lg font-semibold">{message}</p>
            <p className="text-muted-foreground">잠시만 기다려주세요.</p>
        </div>
    </div>
);

export default function HomePage() {
  const { addNote } = useNotes();
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  const handleProgress = (status: string) => setLoadingMessage(status);
  const handleComplete = (note: any) => {
    setIsLoading(false);
    navigate(`/note/${note.id}`);
  };
  const handleError = (error: string) => {
    setIsLoading(false);
    alert(`오류가 발생했습니다: ${error}`);
  };

  const handleYoutubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl) return;
    setIsLoading(true);
    setLoadingMessage('YouTube 영상 요약을 시작합니다...');
    await addNote({ youtubeUrl, onProgress: handleProgress, onComplete: handleComplete, onError: handleError });
  };

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const shareUrl = queryParams.get('share_url');
    if (shareUrl) {
      setYoutubeUrl(shareUrl);
      setIsLoading(true);
      setLoadingMessage('공유된 YouTube 영상 요약을 시작합니다...');
      addNote({ 
        youtubeUrl: shareUrl, 
        onProgress: handleProgress, 
        onComplete: (note) => {
          setIsLoading(false);
          navigate(`/note/${note.id}`, { replace: true });
        }, 
        onError: (error) => {
          setIsLoading(false);
          alert(`오류가 발생했습니다: ${error}`);
          navigate('/', { replace: true });
        } 
      });
    }
  }, [location, addNote, navigate]);


  return (
    <>
      {isLoading && <LoadingOverlay message={loadingMessage} />}
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-4 sm:p-8">
        <div className="w-full max-w-4xl text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            학습의 시작점, Studious
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            AI와 함께 더 스마트하고 효율적으로 학습하세요.
          </p>

          {/* 유튜브 요약 기능은 홈페이지의 핵심 기능으로 유지 */}
          <form onSubmit={handleYoutubeSubmit} className="mt-10 flex items-center gap-2 bg-card border rounded-full p-2 shadow-lg max-w-xl mx-auto">
            <Youtube className="h-5 w-5 text-muted-foreground ml-3 flex-shrink-0" />
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="YouTube 영상 링크를 붙여넣으세요"
              className="flex-grow bg-transparent px-2 py-2 focus:outline-none"
            />
            <Button type="submit" size="icon" className="rounded-full flex-shrink-0">
              <ArrowRight className="h-5 w-5" />
            </Button>
          </form>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-xl mx-auto">
            {/* 다른 기능들은 전용 페이지로 안내하는 카드로 제공 */}
            <Card 
              className="text-left hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              onClick={() => navigate('/chat')}
            >
              <CardHeader>
                <BrainCircuit className="h-8 w-8 text-primary mb-3" />
                <CardTitle>AI 참고서 만들기</CardTitle>
                <CardDescription className="pt-1">PDF, PPT 등 강의 자료로 AI 맞춤 참고서를 만드세요.</CardDescription>
              </CardHeader>
            </Card>
            <Card 
              className="text-left hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              onClick={() => navigate('/review')}
            >
              <CardHeader>
                <File className="h-8 w-8 text-primary mb-3" />
                <CardTitle>AI 복습 노트 생성</CardTitle>
                <CardDescription className="pt-1">학습 자료로 AI가 만드는 핵심 요약과 퀴즈로 복습하세요.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}