import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Loader2, UploadCloud, FileText, X, BookMarked, CalendarDays, BrainCircuit, ChevronsUpDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useNotes, Subject } from '../lib/useNotes';
import { WeekPicker, getWeekNumber } from '../components/WeekPicker';
import { format } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import LoadingOverlay from '../components/LoadingOverlay';
import { upload } from '@vercel/blob/client';
import { convertPdfToImages } from '../lib/pdfUtils';

export default function ChatPage() {
  const { allSubjects, addNoteFromTextbook, saveReviewNote } = useNotes();
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useLiveQuery(() => db.settings.get('default'));

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [isSubjectPopoverOpen, setIsSubjectPopoverOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const [generationType, setGenerationType] = useState<'textbook' | 'review'>('textbook');

  useEffect(() => {
      if (location.state) {
          if (location.state.subject) setSelectedSubject(location.state.subject);
          if (location.state.date) setSelectedDate(new Date(location.state.date));
          if (location.state.type) setGenerationType(location.state.type);
      }
  }, [location.state]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const newFiles = Array.from(e.target.files);
    
    // PDF 변환 처리
    for (const file of newFiles) {
      if (file.type === 'application/pdf') {
        setIsLoading(true);
        try {
          const images = await convertPdfToImages(file, (progress) => {
            setLoadingMessage(`PDF 변환 중... (${progress.pageNumber}/${progress.totalPages})`);
          });
          setUploadedFiles(prev => [...prev, ...images]);
        } catch (error) {
          console.error("PDF 변환 실패:", error);
          alert('PDF 파일을 이미지로 변환하는 데 실패했습니다.');
        } finally {
          setIsLoading(false);
          setLoadingMessage('');
        }
      } else {
        // PDF가 아닌 파일은 직접 추가
        setUploadedFiles(prev => [...prev, file]);
      }
    }
    // 파일 입력 초기화
    if(fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };
  const removeFile = (index: number) => { setUploadedFiles(prev => prev.filter((_, i) => i !== index)); };

  const handleGenerate = async () => {
    if (uploadedFiles.length === 0 || !selectedSubject) {
      alert('과목과 하나 이상의 파일을 업로드해주세요.');
      return;
    }
    setIsLoading(true);

    try {
      setLoadingMessage(`파일 ${uploadedFiles.length}개 업로드 중...`);
      
      const blobResults = await Promise.all(
        uploadedFiles.map(file => 
          upload(file.name, file, {
            access: 'public',
            handleUploadUrl: '/api/upload/route',
          })
        )
      );
      
      setLoadingMessage('AI가 노트를 생성하고 있습니다...');

      const targetApi = generationType === 'review' ? '/api/create_review_note' : '/api/create_textbook';
      
      const api_payload = {
          blobUrls: blobResults.map(b => b.url),
          subject: selectedSubject.name,
          subjectId: selectedSubject.id,
          week: selectedDate 
            ? `${getWeekNumber(selectedDate, settings?.semesterStartDate)}주차 (${format(selectedDate, 'M월 d일')})` 
            : '[N주차]',
          materialTypes: uploadedFiles.map(f => f.type).join(', ') || '[파일]',
          noteDate: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined,
      };

      const response = await fetch(targetApi, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(api_payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || '노트 생성에 실패했습니다.');
      }

      const result = await response.json();

      if (generationType === 'textbook') {
        const newNote = await addNoteFromTextbook(result.title, result.content, result.subjectId, uploadedFiles, api_payload.noteDate);
        alert("AI 참고서가 성공적으로 노트에 저장되었습니다!");
        navigate(`/note/${newNote.id}`);
      } else {
        const { newNote } = await saveReviewNote(result, api_payload.noteDate, allSubjects);
        alert("AI 복습노트가 성공적으로 노트에 저장되었습니다!");
        navigate(`/note/${newNote.id}`);
      }

    } catch(error) {
        alert(`오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
        setIsLoading(false);
    }
  };
  
  return (
    <>
      {isLoading && <LoadingOverlay message={loadingMessage} />}
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl">AI 참고서 만들기</CardTitle>
                <CardDescription>PDF, PPT, 이미지 등 학습 자료를 업로드해주세요. AI가 맞춤 참고서를 만들어 드립니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Popover open={isSubjectPopoverOpen} onOpenChange={setIsSubjectPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="justify-between">
                                <BookMarked className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <span className="truncate">{selectedSubject ? selectedSubject.name : "과목 선택"}</span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            {(allSubjects || []).map((subject) => (
                            <Button key={subject.id} variant="ghost" className="w-full justify-start" onClick={() => { setSelectedSubject(subject); setIsSubjectPopoverOpen(false); }}>
                                <Check className={`mr-2 h-4 w-4 ${selectedSubject?.id === subject.id ? 'opacity-100' : 'opacity-0'}`} />
                                {subject.name}
                            </Button>
                            ))}
                        </PopoverContent>
                    </Popover>
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="justify-between">
                                <CalendarDays className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <span className="truncate">{selectedDate ? `${getWeekNumber(selectedDate, settings?.semesterStartDate)}주차 (${format(selectedDate, "M월 d일")})` : "주차 선택 (날짜)"}</span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2">
                           <WeekPicker onDateSelect={(date) => { setSelectedDate(date); setIsCalendarOpen(false); }} />
                        </PopoverContent>
                    </Popover>
                </div>
                <div 
                  className="w-full min-h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors p-6"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className="h-12 w-12 mb-4" />
                  <p className="font-semibold">파일을 드래그하거나 클릭하여 업로드</p>
                  <input ref={fileInputRef} type="file" multiple onChange={onFileChange} className="hidden" />
                </div>
                {uploadedFiles.length > 0 && (
                  <div className="text-left">
                    <h3 className="font-semibold text-sm mb-2">업로드된 파일:</h3>
                    <ul className="space-y-2">
                      {uploadedFiles.map((file, index) => (
                        <li key={index} className="flex items-center justify-between bg-muted/50 p-2 rounded-lg text-sm">
                          <div className="flex items-center gap-2 min-w-0"><FileText className="h-4 w-4 flex-shrink-0" /><span className="truncate">{file.name}</span></div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => removeFile(index)}><X className="h-4 w-4" /></Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </CardContent>
            <CardFooter>
                 <Button onClick={handleGenerate} size="lg" className="w-full" disabled={isLoading || uploadedFiles.length === 0 || !selectedSubject}>
                    {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <BrainCircuit className="mr-2 h-5 w-5" />}
                    {isLoading ? loadingMessage : `AI ${generationType === 'textbook' ? '참고서' : '복습노트'} 생성`}
                </Button>
            </CardFooter>
        </Card>
      </div>
    </>
  );
}