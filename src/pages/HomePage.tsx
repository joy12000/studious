import React, { useState } from "react";
import { useNotes } from "../lib/useNotes";
import { useNavigate } from "react-router-dom";

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
    // 유튜브 URL 유효성 검사 (간단한 버전)
    if (!youtubeUrl.includes("youtube.com") && !youtubeUrl.includes("youtu.be")) {
      setError("유효한 유튜브 URL이 아닙니다.");
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const newNote = await addNote({ youtubeUrl });
      navigate(`/note/${newNote.id}`); // 저장 후 상세 페이지로 이동
    } catch (err) {
      setError(err instanceof Error ? err.message : "요약에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight mb-6">유튜브 영상 요약</h1>
      
      <div className="p-6 bg-card/60 rounded-2xl shadow-lg border">
        <input
          type="url"
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          className="w-full text-lg p-3 border rounded-lg focus:ring-2 focus:ring-primary"
          placeholder="여기에 유튜브 링크를 붙여넣으세요..."
        />
        {error && <p className="text-destructive text-sm mt-2">{error}</p>}
        <div className="mt-4 text-right">
          <button 
            onClick={handleSave} 
            disabled={isLoading}
            className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? "요약 중..." : "요약 저장하기"}
          </button>
        </div>
      </div>
    </div>
  );
}