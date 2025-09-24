import React, { useState, useEffect } from "react";
import { useNotes, Subject } from "../lib/useNotes";
import { useNavigate } from "react-router-dom";
import { Loader2, UploadCloud, FileText, X, Plus, BrainCircuit, ChevronsUpDown, BookMarked, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Note } from '../lib/types';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import * as pdfjsLib from 'pdfjs-dist';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

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

const FilePreview = ({ file, onRemove }: { file: File; onRemove: () => void; }) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        let objectUrl: string | null = null;
        const generatePreview = async () => {
            if (file.type.startsWith('image/')) {
                objectUrl = URL.createObjectURL(file);
                setPreviewUrl(objectUrl);
            } else if (file.type === 'application/pdf') {
                try {
                    const fileReader = new FileReader();
                    fileReader.onload = async (event) => {
                        if (!event.target?.result) return;
                        const typedArray = new Uint8Array(event.target.result as ArrayBuffer);
                        const loadingTask = pdfjsLib.getDocument(typedArray);
                        const pdf = await loadingTask.promise;
                        const page = await pdf.getPage(1);
                        const viewport = page.getViewport({ scale: 0.5 });
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        if (context) {
                            await page.render({ canvasContext: context, viewport: viewport }).promise;
                            setPreviewUrl(canvas.toDataURL());
                        }
                    };
                    fileReader.readAsArrayBuffer(file);
                } catch (error) {
                    console.error("PDF 썸네일 생성 실패:", error);
                    setPreviewUrl(null); // 실패 시 아이콘 표시
                }
            }
        };

        generatePreview();

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [file]);

    return (
        <div className="relative w-24 h-24 rounded-lg border bg-muted flex items-center justify-center overflow-hidden group">
            {previewUrl ? (
                <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
            ) : (
                <FileText className="w-8 h-8 text-muted-foreground" />
            )}
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-xs text-center break-words line-clamp-2">{file.name}</p>
            </div>
            <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={onRemove}>
                <X className="h-4 w-4" />
            </Button>
        </div>
    );
};

export default function AssignmentHelperPage() {
    const { notes, allSubjects, addNoteFromAssignment } = useNotes();
    const navigate = useNavigate();

    const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
    const [problemFiles, setProblemFiles] = useState<File[]>([]);
    const [answerFiles, setAnswerFiles] = useState<File[]>([]);
    const [progressMessage, setProgressMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isNotePickerOpen, setIsNotePickerOpen] = useState(false);
    const [selectedExistingNotes, setSelectedExistingNotes] = useState<Note[]>([]);
    const [noteSearchQuery, setNoteSearchQuery] = useState('');
    const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
    const [isSubjectPopoverOpen, setIsSubjectPopoverOpen] = useState(false);

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

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<File[]>>) => {
        if (e.target.files) {
            setter(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };
    
    const removeFile = (index: number, setter: React.Dispatch<React.SetStateAction<File[]>>) => {
        setter(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (problemFiles.length === 0) {
            setError("과제 문제 파일을 반드시 업로드해야 합니다.");
            return;
        }
        if (!selectedSubject) {
            setError("과제를 제출할 과목을 선택해주세요.");
            return;
        }
        if (answerFiles.length === 0) {
            if (!window.confirm("답안 파일이 없습니다. AI가 문제에 대한 모범 풀이를 생성하도록 할까요?")) {
                return;
            }
        }
        setError(null);
        setProgressMessage('파일을 Vercel Blob에 업로드하는 중...');

        try {
            const uploadFile = async (file: File) => {
                const newBlob = await upload(file.name, file, {
                    access: 'public',
                    handleUploadUrl: '/api/upload/route',
                });
                return newBlob.url;
            };

            const referenceFileUrls = await Promise.all(referenceFiles.map(uploadFile));
            setProgressMessage('참고 자료 업로드 완료. 과제 문제 업로드 중...');
            const problemFileUrls = await Promise.all(problemFiles.map(uploadFile));
            setProgressMessage('과제 문제 업로드 완료. 답안 파일 업로드 중...');
            const answerFileUrls = await Promise.all(answerFiles.map(uploadFile));
            setProgressMessage('모든 파일 업로드 완료. AI 분석 시작...');

            const noteContext = selectedExistingNotes.map(n => `[기존 노트: ${n.title}]\n${n.content}`).join('\n\n');

            await addNoteFromAssignment({
                referenceFileUrls,
                problemFileUrls,
                answerFileUrls,
                noteContext,
                subjectId: selectedSubject.id,
                onProgress: setProgressMessage,
                onComplete: (newNote) => {
                    setProgressMessage(null);
                    alert("AI 과제 도우미 작업이 완료되었습니다! 생성된 노트로 이동합니다.");
                    navigate(`/note/${newNote.id}`);
                },
                onError: (err) => {
                    setProgressMessage(null);
                    setError(err instanceof Error ? err.message : '파일 업로드 또는 노트 생성 중 오류가 발생했습니다.');
                }
            });
        } catch (error) {
            setProgressMessage(null);
            setError(error instanceof Error ? error.message : '파일 업로드 또는 노트 생성 중 오류가 발생했습니다.');
        }
    };
    
    const isLoading = progressMessage !== null;

    const FileUploadArea = ({ files, setFiles, inputId }: { files: File[], setFiles: React.Dispatch<React.SetStateAction<File[]>>, inputId: string }) => {
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
                onFileChange(e as any, setFiles);
                e.dataTransfer.clearData();
            }
        };

        return (
            <>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {files.map((file, index) => (
                        <FilePreview key={index} file={file} onRemove={() => removeFile(index, setFiles)} />
                    ))}
                    <div
                        className={`w-24 h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'hover:bg-muted/50'}`}
                        onClick={() => document.getElementById(inputId)?.click()}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <UploadCloud className="h-8 w-8" />
                    </div>
                </div>
                <input id={inputId} type="file" multiple onChange={(e) => onFileChange(e, setFiles)} className="hidden" />
            </>
        );
    };

    return (
        <>
            {isLoading && <LoadingOverlay message={progressMessage as string} />}
            <div className="w-full max-w-4xl mx-auto space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">AI 과제 도우미</h1>
                    <p className="text-muted-foreground mt-2">참고 자료, 문제, 답안을 올리면 AI가 채점하거나 풀이를 제공합니다.</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Step 1: 과목 선택</CardTitle>
                        <CardDescription>어떤 과제인지 알려주세요.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Popover open={isSubjectPopoverOpen} onOpenChange={setIsSubjectPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full max-w-sm justify-between">
                                    <div className="flex items-center">
                                        <BookMarked className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                        <span className="truncate">{selectedSubject ? selectedSubject.name : "과목 선택"}</span>
                                    </div>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                {allSubjects.map((subject) => (
                                <Button key={subject.id} variant="ghost" className="w-full justify-start" onClick={() => { setSelectedSubject(subject); setIsSubjectPopoverOpen(false); }}>
                                    <Check className={`mr-2 h-4 w-4 ${selectedSubject?.id === subject.id ? 'opacity-100' : 'opacity-0'}`} />
                                    {subject.name}
                                </Button>
                                ))}
                            </PopoverContent>
                        </Popover>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Step 2: 참고 자료 (선택)</CardTitle>
                        <CardDescription>AI가 참고할 강의 자료나 이전에 작성한 노트를 추가하세요.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Popover open={isNotePickerOpen} onOpenChange={setIsNotePickerOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full max-w-sm">
                              <Plus className="mr-2 h-4 w-4" />
                              기존 노트 추가
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <div className="p-2">
                                  <input 
                                    type="text" 
                                    placeholder="노트 검색..." 
                                    className="w-full p-2 border rounded-md mb-2"
                                    value={noteSearchQuery}
                                    onChange={(e) => setNoteSearchQuery(e.target.value)}
                                  />
                                  <div className="max-h-60 overflow-y-auto">
                                    {filteredNotes.length > 0 ? (
                                      filteredNotes.map(note => (
                                        <div key={note.id} className="flex items-center justify-between p-2 hover:bg-muted rounded-md">
                                          <label htmlFor={`note-${note.id}`} className="flex items-center gap-2 cursor-pointer flex-1">
                                            <input 
                                              type="checkbox" 
                                              id={`note-${note.id}`} 
                                              checked={selectedExistingNotes.some(n => n.id === note.id)}
                                              onChange={() => handleToggleNoteSelection(note)}
                                              className="form-checkbox h-4 w-4 text-primary rounded"
                                            />
                                            <span className="text-sm truncate">{note.title || '제목 없음'}</span>
                                          </label>
                                        </div>
                                      ))
                                    ) : ( <p className="text-sm text-muted-foreground text-center">노트가 없습니다.</p> )}
                                  </div>
                                </div>
                                <div className="p-2 border-t">
                                  <Button onClick={() => setIsNotePickerOpen(false)} className="w-full">선택 완료</Button>
                                </div>
                          </PopoverContent>
                        </Popover>
                        {selectedExistingNotes.length > 0 && (
                            <div className="text-left">
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
                        <FileUploadArea files={referenceFiles} setFiles={setReferenceFiles} inputId="reference-file-upload" />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Step 3: 과제물 업로드</CardTitle>
                        <CardDescription>문제 파일은 필수입니다. 본인 답안이 있으면 함께 업로드하세요.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <h3 className="font-medium">문제 파일*</h3>
                            <FileUploadArea files={problemFiles} setFiles={setProblemFiles} inputId="problem-file-upload" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-medium">내 답안 (선택)</h3>
                            <FileUploadArea files={answerFiles} setFiles={setAnswerFiles} inputId="answer-file-upload" />
                        </div>
                    </CardContent>
                </Card>
                
                {error && <p className="text-center text-destructive text-sm">{error}</p>}

                <div className="flex justify-center pb-8">
                    <Button size="lg" onClick={handleSubmit} disabled={isLoading || problemFiles.length === 0 || !selectedSubject}>
                        <BrainCircuit className="mr-2 h-5 w-5"/>
                        {isLoading ? "AI 분석 중..." : (answerFiles.length > 0 ? "AI 채점 요청" : "AI 풀이 생성")}
                    </Button>
                </div>
            </div>
        </>
    );
}