// src/pages/ReviewPage.tsx
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

// ... (LoadingOverlay component remains the same) ...

export default function ReviewPage() {
    // ... (All hooks and state variables remain the same) ...
  const handleSave = async () => { /* ... (handleSave logic remains the same) ... */ };
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { /* ... */ };
  const removeFile = (index: number) => { /* ... */ };
  
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
          onFileChange({ target: { files: e.dataTransfer.files } } as React.ChangeEvent<HTMLInputElement>);
          e.dataTransfer.clearData();
      }
  };

  const isLoading = progressMessage !== null;

  return (
    <>
      {isLoading && <LoadingOverlay message={loadingMessage as string} />}
      <div className="min-h-full w-full flex flex-col items-center justify-center p-4">
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
                        <PopoverContent className="w-auto p-0"><WeekPicker onDateSelect={(date) => { setSelectedDate(date); setIsCalendarOpen(false); }} /></PopoverContent>
                    </Popover>
                    <Popover open={isNotePickerOpen} onOpenChange={setIsNotePickerOpen}>
                        <PopoverTrigger asChild><Button variant="outline" className="flex-1"><Plus className="mr-2 h-4 w-4" />기존 노트 추가</Button></PopoverTrigger>
                        <PopoverContent className="w-80 p-0">{/* ... Popover content ... */}</PopoverContent>
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
                        <ul className="space-y-2">{/* ... File list rendering ... */}</ul>
                    </div>
                )}
                {selectedExistingNotes.length > 0 && (
                    <div className="text-left mt-4">
                        <h3 className="font-semibold text-sm mb-2">선택된 기존 노트:</h3>
                        <ul className="space-y-2">{/* ... Note list rendering ... */}</ul>
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