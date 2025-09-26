import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Loader2, UploadCloud, FileText, X, BookMarked, CalendarDays, BrainCircuit, ChevronsUpDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotes, Subject } from '../lib/useNotes';
import { WeekPicker, getWeekNumber } from '../components/WeekPicker';
import { format } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import LoadingOverlay from '../components/LoadingOverlay';
import { upload } from '@vercel/blob/client';
import { convertPdfToImages } from '../lib/pdfUtils';
import { v4 as uuidv4 } from 'uuid';

export default function ChatPage() {
  const { allSubjects, addNoteFromTextbook } = useNotes();
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useLiveQuery(() => db.settings.get('default'));

  const [isUploading, setIsUploading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [isSubjectPopoverOpen, setIsSubjectPopoverOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const MAX_FILE_SIZE_MB = 5;
  const MAX_TOTAL_SIZE_MB = 10;

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          onFileChange(e.dataTransfer.files);
          e.dataTransfer.clearData();
      }
  };

  useEffect(() => {
      if (location.state) {
          if (location.state.subject) setSelectedSubject(location.state.subject);
          if (location.state.date) setSelectedDate(new Date(location.state.date));
      }
  }, [location.state]);

  const onFileChange = async (files: FileList | null) => {
    if (!files) return;

    const newFiles = Array.from(files);
    let filesToAdd: File[] = [];
    let currentTotalSize = uploadedFiles.reduce((sum, file) => sum + file.size, 0);

    for (const file of newFiles) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        alert(`개별 파일 크기는 ${MAX_FILE_SIZE_MB}MB를 초과할 수 없습니다: ${file.name}`);
        continue;
      }

      if (file.type === 'application/pdf') {
        const isScanned = window.confirm("이 PDF가 스캔된 문서인가요? (텍스트 선택이 불가능한 경우) '확인'을 누르면 이미지로 변환하고, '취소'를 누르면 텍스트로 처리합니다.");
        if (isScanned) {
            setIsUploading(true);
            try {
              const images = await convertPdfToImages(file, (progress) => {
                setLoadingMessage(`PDF 변환 중... (${progress.pageNumber}/${progress.totalPages})`);
              });
              filesToAdd.push(...images);
            } catch (error) {
              console.error("PDF 변환 실패:", error);
              alert('PDF 파일을 이미지로 변환하는 데 실패했습니다.');
            } finally {
              setIsUploading(false);
              setLoadingMessage('');
            }
        } else {
            filesToAdd.push(file);
        }
      } else {
        filesToAdd.push(file);
      }
    }

    const totalSizeAfterAdding = currentTotalSize + filesToAdd.reduce((sum, file) => sum + file.size, 0);
    if (totalSizeAfterAdding > MAX_TOTAL_SIZE_MB * 1024 * 1024) {
      alert(`총 파일 크기는 ${MAX_TOTAL_SIZE_MB}MB를 초과할 수 없습니다.`);
      return;
    }

    setUploadedFiles(prev => [...prev, ...filesToAdd]);

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

    alert("백그라운드에서 참고서 생성을 시작합니다. 완료되면 알려드릴게요!");
    navigate('/');

    setIsUploading(true);
    setLoadingMessage(`파일 ${uploadedFiles.length}개 업로드 중...`);

    try {
      const blobResults = await Promise.all(
        uploadedFiles.map(file => 
          upload(file.name, file, {
            access: 'public',
            handleUploadUrl: '/api/upload/route',
          })
        )
      );
      
      setIsUploading(false);

      const noteId = uuidv4();
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

      await addNoteFromTextbook(
        `[생성 중] ${selectedSubject.name} 참고서`,
        'AI가 참고서를 생성하고 있습니다. 잠시만 기다려주세요...',
        selectedSubject.id,
        uploadedFiles,
        api_payload.noteDate,
        noteId
      );

      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'GENERATE_TEXTBOOK',
          payload: {
            noteId: noteId,
            body: api_payload,
          },
        });
      } else {
        throw new Error("Service Worker가 활성화되어 있지 않아 백그라운드 생성을 진행할 수 없습니다.");
      }

    } catch(error) {
        console.error("참고서 생성 사전 작업(파일 업로드 등) 중 오류 발생:", error);
        alert(`백그라운드 생성 시작 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        navigate('/');
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <>
      {isUploading && <LoadingOverlay message={loadingMessage} />}
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
                  className={`w-full min-h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground cursor-pointer transition-colors p-6 ${isDragging ? 'border-primary bg-primary/10' : 'hover:bg-muted/50'}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <UploadCloud className="h-12 w-12 mb-4" />
                  <p className="font-semibold">파일을 드래그하거나 클릭하여 업로드</p>
                  <input ref={fileInputRef} type="file" multiple onChange={(e) => onFileChange(e.target.files)} className="hidden" />
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
                 <Button onClick={handleGenerate} size="lg" className="w-full" disabled={isUploading || uploadedFiles.length === 0 || !selectedSubject}>
                    {isUploading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <BrainCircuit className="mr-2 h-5 w-5" />}
                    {isUploading ? loadingMessage : `AI 참고서 생성`}
                </Button>
            </CardFooter>
        </Card>
      </div>
    </>
  );
}
