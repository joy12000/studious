import React, { useState } from "react";
import { useNotes } from "../lib/useNotes";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowRight, UploadCloud, FileText, X, ChevronsUpDown, CalendarDays } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { WeekPicker } from '../components/WeekPicker';
import { format } from 'date-fns';

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

export default function ReviewPage() {
  const { addNoteFromReview, allSubjects } = useNotes();
  const navigate = useNavigate();
  
  const [files, setFiles] = useState<File[]>([]);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);


  const handleSave = async () => {
    if (files.length === 0) {
      setError("하나 이상의 학습 자료를 업로드해주세요.");
      return;
    }
    setError(null);
    setProgressMessage("복습 노트를 생성하는 중...");

    const noteDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined;

    await addNoteFromReview({
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
      noteDate: noteDateStr,
    });
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const isLoading = progressMessage !== null;

  return (
    <>
      {isLoading && <LoadingOverlay message={progressMessage as string} />}
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">AI 복습 노트</h1>
            <p className="text-muted-foreground mt-2">학습 자료를 올리면 AI가 요약하고 퀴즈를 만들어줘요.</p>
          </div>

          <div className="mb-4">
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">
                  <div className="flex items-center">
                    <CalendarDays className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <span className="truncate">
                      {selectedDate ? format(selectedDate, "yyyy년 M월 d일") : "노트 날짜 선택 (선택 사항)"}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <WeekPicker onDateSelect={(date) => {
                  setSelectedDate(date);
                  setIsCalendarOpen(false);
                }} />
              </PopoverContent>
            </Popover>
          </div>
          
          <div 
            className="w-full min-h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors p-6"
            onClick={() => document.getElementById('file-upload-review')?.click()}
          >
            <UploadCloud className="h-12 w-12 mb-2" />
            <p className="font-semibold">파일을 드래그하거나 클릭해서 업로드</p>
            <input id="file-upload-review" type="file" multiple onChange={onFileChange} className="hidden" />
          </div>

          {files.length > 0 && (
            <div className="mt-4 text-left">
              <h3 className="font-semibold text-sm mb-2">업로드된 파일:</h3>
              <ul className="space-y-2">
                {files.map((file, index) => (
                  <li key={index} className="flex items-center justify-between bg-muted/50 p-2 rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm truncate">{file.name}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => removeFile(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {error && <p className="text-destructive text-sm mt-4 text-center">{error}</p>}

          <div className="mt-6 text-center">
            <Button size="lg" onClick={handleSave} disabled={isLoading || files.length === 0}>
              {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <ArrowRight className="mr-2 h-5 w-5"/>}
              복습 노트 생성
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}