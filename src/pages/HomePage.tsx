import React, { useState } from "react";
import { useNotes } from "../lib/useNotes";
import { useNavigate } from "react-router-dom";
import { Loader2, Youtube } from "lucide-react";

function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-lg bg-card p-8 text-card-foreground shadow-xl">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-medium">AI가 노트를 생성하고 있습니다.</p>
        <p className="text-sm text-muted-foreground">잠시만 기다려주세요...</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { addNote } = useNotes();
  const navigate = useNavigate();
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!youtubeUrl.trim()) {
      setError("유튜브 URL을 입력해주세요.");
      return;
    }
    if (!youtubeUrl.includes("youtube.com") && !youtubeUrl.includes("youtu.be")) {
      setError("유효한 유튜브 URL이 아닙니다.");
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const newNote = await addNote({ youtubeUrl });
      navigate(`/note/${newNote.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "요약에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {isLoading && <LoadingOverlay />}
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-3xl text-center">
          
          {/* 🚀 글씨 크기 수정 */}
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-12">
            AI가 영상의 핵심만 요약해 드립니다.
          </h1>

          <div className="relative">
            <div className="relative flex items-center w-full">
              <Youtube className="absolute left-6 h-6 w-6 text-muted-foreground" />
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="w-full pl-16 pr-32 py-4 text-lg border bg-card rounded-full shadow-md focus:ring-2 focus:ring-primary focus:border-transparent focus:shadow-lg transition-all disabled:opacity-70"
                placeholder="유튜브 링크 붙여넣기"
                disabled={isLoading}
              />
              {/* 🚀 버튼 크기 수정 */}
              <button 
                onClick={handleSave} 
                disabled={isLoading}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center bg-primary text-primary-foreground h-12 px-6 rounded-full font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "요약"}
              </button>
            </div>
            {error && <p className="text-destructive text-sm mt-4 text-center">{error}</p>}
          </div>

        </div>
      </div>
    </>
  );
}