// src/pages/AssignmentHelperPage.tsx
import React, { useState, useMemo } from "react";
import { useNotes } from "../lib/useNotes";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowRight, UploadCloud, FileText, X, Plus, ExternalLink, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Note } from '../lib/types';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// 로딩 오버레이 컴포넌트 (ReviewPage와 동일)
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

export default function AssignmentHelperPage() {
    const { notes } = useNotes();
    const navigate = useNavigate();

    // 섹션별 파일 상태 관리
    const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
    const [problemFiles, setProblemFiles] = useState<File[]>([]);
    const [answerFiles, setAnswerFiles] = useState<File[]>([]);

    const [progressMessage, setProgressMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // 기존 노트 선택 관련 상태
    const [isNotePickerOpen, setIsNotePickerOpen] = useState(false);
    const [selectedExistingNotes, setSelectedExistingNotes] = useState<Note[]>([]);
    const [noteSearchQuery, setNoteSearchQuery] = useState('');

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
    
    // 파일 변경 핸들러
    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<File[]>>) => {
        if (e.target.files) {
            setter(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };
    
    // 파일 삭제 핸들러
    const removeFile = (index: number, setter: React.Dispatch<React.SetStateAction<File[]>>) => {
        setter(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (problemFiles.length === 0) {
            setError("과제 문제 파일을 반드시 업로드해야 합니다.");
            return;
        }

        if (answerFiles.length === 0) {
            if (!window.confirm("답안 파일이 없습니다. AI가 문제에 대한 모범 풀이를 생성하도록 할까요?")) {
                return; // 사용자가 취소하면 중단
            }
        }
        setError(null);
        setProgressMessage("AI 과제 도우미를 실행하는 중...");

        // 여기에 실제 API 호출 로직을 구현합니다.
        // 1. FormData 생성
        const formData = new FormData();

        // 2. 참고자료, 문제, 답안 파일 추가
        referenceFiles.forEach(file => formData.append('reference_files', file));
        problemFiles.forEach(file => formData.append('problem_files', file));
        answerFiles.forEach(file => formData.append('answer_files', file));
        
        // 3. 기존 노트 내용 추가
        const combinedNoteContent = selectedExistingNotes.map(n => `[기존 노트: ${n.title}]\n${n.content}`).join('\n\n');
        formData.append('note_context', combinedNoteContent);

        console.log("API로 전송될 데이터:", {
            referenceFiles,
            problemFiles,
            answerFiles,
            combinedNoteContent
        });
        
        // 가상의 API 호출 및 결과 처리
        setTimeout(() => {
            setProgressMessage(null);
            alert("API 호출 기능이 구현되면 이곳에서 결과 페이지로 이동합니다.");
            // navigate(`/note/new-assignment-note-id`);
        }, 3000);
    };
    
    const isLoading = progressMessage !== null;

    // 공통 파일 업로드 UI 컴포넌트
    const FileUploadSection = ({ title, files, setFiles, inputId }: { title: string, files: File[], setFiles: React.Dispatch<React.SetStateAction<File[]>>, inputId: string }) => (
        <div>
            <h2 className="text-lg font-semibold mb-3">{title}</h2>
            <div
                className="w-full min-h-36 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors p-4"
                onClick={() => document.getElementById(inputId)?.click()}
            >
                <UploadCloud className="h-10 w-10 mb-2" />
                <p className="font-semibold text-sm">파일을 드래그하거나 클릭해서 업로드</p>
                <input id={inputId} type="file" multiple onChange={(e) => onFileChange(e, setFiles)} className="hidden" />
            </div>
            {files.length > 0 && (
                <div className="mt-4 text-left">
                    <ul className="space-y-2">
                        {files.map((file, index) => (
                            <li key={index} className="flex items-center justify-between bg-muted/50 p-2 rounded-lg text-sm">
                                <div className="flex items-center gap-2 min-w-0"><FileText className="h-4 w-4 flex-shrink-0" /><span className="truncate">{file.name}</span></div>
                                <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => removeFile(index, setFiles)}><X className="h-4 w-4" /></Button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );

    return (
        <>
            {isLoading && <LoadingOverlay message={progressMessage as string} />}
            <div className="min-h-screen w-full flex flex-col items-center bg-background p-4">
                <div className="w-full max-w-3xl space-y-8">
                    <div className="text-center">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">AI 과제 도우미</h1>
                        <p className="text-muted-foreground mt-2">참고 자료, 문제, 답안을 올리면 AI가 채점하거나 풀이를 제공해줘요.</p>
                        <Button variant="outline" size="sm" className="mt-4" onClick={() => window.open('https://eclass3.cau.ac.kr/', '_blank')}>
                            중앙대학교 e-class 바로가기 <ExternalLink className="ml-2 h-4 w-4"/>
                        </Button>
                    </div>

                    {/* 참고 자료 섹션 */}
                    <div>
                        <h2 className="text-lg font-semibold mb-3">1. 참고 자료 (선택)</h2>
                        <Popover open={isNotePickerOpen} onOpenChange={setIsNotePickerOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full mb-4">
                              <Plus className="mr-2 h-4 w-4" />
                              기존 노트 추가
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                <div className="p-2">
                                  <input type="text" placeholder="노트 검색..." className="w-full p-2 border rounded-md mb-2" value={noteSearchQuery} onChange={(e) => setNoteSearchQuery(e.target.value)} />
                                  <div className="max-h-60 overflow-y-auto">
                                    {filteredNotes.length > 0 ? (
                                      filteredNotes.map(note => (
                                        <div key={note.id} className="flex items-center justify-between p-2 hover:bg-muted rounded-md">
                                          <label htmlFor={`note-${note.id}`} className="flex items-center gap-2 cursor-pointer flex-1">
                                            <input type="checkbox" id={`note-${note.id}`} checked={selectedExistingNotes.some(n => n.id === note.id)} onChange={() => handleToggleNoteSelection(note)} className="form-checkbox h-4 w-4 text-primary rounded" />
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
                            <div className="mb-4 text-left">
                                <h3 className="font-semibold text-xs text-muted-foreground mb-2">선택된 노트:</h3>
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
                        <FileUploadSection title="" files={referenceFiles} setFiles={setReferenceFiles} inputId="reference-file-upload" />
                    </div>

                    {/* 문제 및 답안 섹션 */}
                    <div className="grid md:grid-cols-2 gap-8">
                        <FileUploadSection title="2. 과제 문제" files={problemFiles} setFiles={setProblemFiles} inputId="problem-file-upload" />
                        <FileUploadSection title="3. 내 답안 (선택)" files={answerFiles} setFiles={setAnswerFiles} inputId="answer-file-upload" />
                    </div>
                    
                    {error && <p className="text-destructive text-sm text-center">{error}</p>}

                    <div className="mt-8 text-center">
                        <Button size="lg" onClick={handleSubmit} disabled={isLoading || problemFiles.length === 0}>
                            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <BrainCircuit className="mr-2 h-5 w-5"/>}
                            {answerFiles.length > 0 ? "AI 채점 요청" : "AI 풀이 생성"}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}