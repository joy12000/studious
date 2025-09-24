import React, { useState, useEffect } from "react";
import { useNotes } from "../lib/useNotes";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, ArrowRight, UploadCloud, FileText, X, ChevronsUpDown, CalendarDays, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { WeekPicker } from '../components/WeekPicker';
import { format } from 'date-fns';
import { Note } from '../lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import LoadingOverlay from '../components/LoadingOverlay';
import { useLoading } from "../lib/useLoading";
import { convertPdfToImages } from "../lib/pdfUtils";

export default function ReviewPage() {
  const { addNoteFromReview, allSubjects, notes } = useNotes();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [files, setFiles] = useState<File[]>([]);
  const { isLoading, loadingMessage, startLoading, stopLoading, setMessage } = useLoading();
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isNotePickerOpen, setIsNotePickerOpen] = useState(false);
  const [selectedExistingNotes, setSelectedExistingNotes] = useState<Note[]>([]);
  const [noteSearchQuery, setNoteSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (location.state?.date) {
      const dateFromState = new Date(location.state.date);
      if (!isNaN(dateFromState.getTime())) {
        setSelectedDate(dateFromState);
      }
    }
  }, [location.state]);

  const filteredNotes = (notes || []).filter(note => 
    note.title.toLowerCase().includes(noteSearchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(noteSearchQuery.toLowerCase())
  );

  const handleToggleNoteSelection = (note: Note) => {
    setSelectedExistingNotes(prev => 
      prev.some(n => n.id === note.id)
        ? prev.filter(n => n.id !== note.id)
        : [...prev, note]
    );
  };

  const handleRemoveSelectedNote = (noteId: string) => {
    setSelectedExistingNotes(prev => prev.filter(n => n.id !== noteId));
  };

  const handleSave = async () => {
    if (files.length === 0 && selectedExistingNotes.length === 0) {
      setError("하나 이상의 학습 자료 또는 기존 노트를 선택해주세요.");
      return;
    }
    setError(null);
    startLoading("복습 노트를 생성하는 중...");

    const noteDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined;
    let combinedContent = "";
    const combinedFiles: File[] = [...files];

    selectedExistingNotes.forEach(note => {
      combinedContent += `

--- 기존 노트: ${note.title} ---
${note.content}`;
    });

    await addNoteFromReview({
      files: combinedFiles,
      subjects: allSubjects || [],
      onProgress: setMessage,
      onComplete: (newNote) => {
        stopLoading();
        navigate(`/note/${newNote.id}`);
      },
      onError: (err) => {
        setError(err);
        stopLoading();
      },
      noteDate: noteDateStr,
      aiConversationText: combinedContent.trim(),
    });
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);

    for (const file of newFiles) {
      if (file.type === 'application/pdf') {
        startLoading('PDF를 이미지로 변환 중...');
        try {
          const images = await convertPdfToImages(file, (progress) => {
            setMessage(`PDF 변환 중... (${progress.pageNumber}/${progress.totalPages})`);
          });
          setFiles(prev => [...prev, ...images]);
        } catch (error) {
          console.error("PDF 변환 실패:", error);
          setError('PDF 파일을 이미지로 변환하는 데 실패했습니다.');
        } finally {
          stopLoading();
        }
      } else {
        setFiles(prev => [...prev, file]);
      }
    }
    if (e.target) e.target.value = '';
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const mockEvent = { target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>;
          onFileChange(mockEvent);
          e.dataTransfer.clearData();
      }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

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

  return (
    <>
      {isLoading && <LoadingOverlay message={loadingMessage as string} />}
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl">AI 복습 노트</CardTitle>
                <CardDescription>학습 자료나 기존 노트를 선택하여 AI 요약 및 퀴즈를 만드세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="flex-1 justify-between">
                                <CalendarDays className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <span className="truncate">{selectedDate ? format(selectedDate, "yyyy년 M월 d일") : "노트 날짜 선택 (선택)"}</span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2"><WeekPicker onDateSelect={(date) => { setSelectedDate(date); setIsCalendarOpen(false); }} /></PopoverContent>
                    </Popover>
                    <Popover open={isNotePickerOpen} onOpenChange={setIsNotePickerOpen}>
                        <PopoverTrigger asChild><Button variant="outline" className="flex-1"><Plus className="mr-2 h-4 w-4" />기존 노트 추가</Button></PopoverTrigger>
                        <PopoverContent className="w-[300px] sm:w-[400px] p-0">
                            <div className="p-2">
                              <input 
                                type="text" 
                                placeholder="노트 검색..." 
                                className="w-full p-2 border rounded-md mb-2 bg-transparent"
                                value={noteSearchQuery}
                                onChange={(e) => setNoteSearchQuery(e.target.value)}
                              />
                              <div className="max-h-60 overflow-y-auto">
                                {filteredNotes.length > 0 ? (
                                  filteredNotes.map(note => (
                                    <div key={note.id} className="flex items-center justify-between p-2 hover:bg-muted rounded-md">
                                      <label htmlFor={`note-${note.id}`} className="flex items-center gap-2 cursor-pointer flex-1 truncate">
                                        <input 
                                          type="checkbox" 
                                          id={`note-${note.id}`} 
                                          checked={selectedExistingNotes.some(n => n.id === note.id)}
                                          onChange={() => handleToggleNoteSelection(note)}
                                          className="form-checkbox h-4 w-4 text-primary rounded focus:ring-primary"
                                        />
                                        <span className="text-sm truncate">{note.title || '제목 없음'}</span>
                                      </label>
                                    </div>
                                  ))
                                ) : ( <p className="text-sm text-muted-foreground text-center p-4">일치하는 노트가 없습니다.</p> )}
                              </div>
                            </div>
                            <div className="p-2 border-t bg-background">
                              <Button onClick={() => setIsNotePickerOpen(false)} className="w-full">선택 완료</Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
                <div 
                    className={`w-full min-h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground cursor-pointer transition-colors p-6 ${isDragging ? 'border-primary bg-primary/10' : 'hover:bg-muted/50'}`}
                    onClick={() => document.getElementById('file-upload-review')?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <UploadCloud className="h-12 w-12 mb-2" />
                    <p className="font-semibold">파일을 드래그하거나 클릭해서 업로드</p>
                    <input id="file-upload-review" type="file" multiple onChange={onFileChange} className="hidden" />
                </div>
                {files.length > 0 && (
                    <div className="text-left">
                        <h3 className="font-semibold text-sm mb-2">업로드된 파일:</h3>
                        <ul className="space-y-2">
                          {files.map((file, index) => (
                            <li key={index} className="flex items-center justify-between bg-muted/50 p-2 rounded-lg text-sm">
                              <div className="flex items-center gap-2 min-w-0"><FileText className="h-4 w-4 flex-shrink-0" /><span className="truncate">{file.name}</span></div>
                              <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => removeFile(index)}><X className="h-4 w-4" /></Button>
                            </li>
                          ))}
                        </ul>
                    </div>
                )}
                {selectedExistingNotes.length > 0 && (
                    <div className="text-left mt-4">
                        <h3 className="font-semibold text-sm mb-2">선택된 기존 노트:</h3>
                        <ul className="space-y-2">
                            {selectedExistingNotes.map(note => (
                                <li key={note.id} className="flex items-center justify-between bg-muted/50 p-2 rounded-lg text-sm">
                                    <div className="flex items-center gap-2 min-w-0"><FileText className="h-4 w-4 flex-shrink-0" /><span className="truncate">{note.title || '제목 없음'}</span></div>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => handleRemoveSelectedNote(note.id)}><X className="h-4 w-4" /></Button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex-col gap-4 pt-4">
                {error && <p className="text-destructive text-sm text-center">{error}</p>}
                <Button size="lg" className="w-full" onClick={handleSave} disabled={isLoading || (files.length === 0 && selectedExistingNotes.length === 0)}>
                    {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <ArrowRight className="mr-2 h-5 w-5"/>}
                    복습 노트 생성
                </Button>
            </CardFooter>
        </Card>
      </div>
    </>
  );
}
