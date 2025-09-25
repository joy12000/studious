// src/pages/ReviewDeckPage.tsx
import React, { useState, useEffect } from 'react';
import { useNotes } from '../lib/useNotes';
import { ReviewItem } from '../lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Trash2, Loader2, UploadCloud, FileText, X, BrainCircuit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import { upload } from '@vercel/blob/client';
import { convertPdfToImages } from "../lib/pdfUtils";

// Helper Components (copied from AssignmentHelperPage)
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
                    setPreviewUrl(null);
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


const ReviewCard = ({ item, onAnswer, onDelete }: { item: ReviewItem; onAnswer: (correct: boolean) => void; onDelete: () => void; }) => {
    const [selected, setSelected] = useState<string | null>(null);
    const [revealed, setRevealed] = useState(false);
    const navigate = useNavigate();

    const handleSelect = (option: string) => {
        if (revealed) return;
        setSelected(option);
    };

    const handleReveal = () => {
        if (!selected) return;
        setRevealed(true);
        onAnswer(selected === item.answer);
    };

    const getButtonVariant = (option: string) => {
        if (!revealed) {
            return selected === option ? 'secondary' : 'outline';
        }
        if (option === item.answer) return 'success';
        if (option === selected) return 'destructive';
        return 'outline';
    };

    return (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>{item.question}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {item.options.map(option => (
                    <Button
                        key={option}
                        variant={getButtonVariant(option)}
                        onClick={() => handleSelect(option)}
                        className="h-auto whitespace-normal justify-start text-left"
                    >
                        {option}
                    </Button>
                ))}
            </CardContent>
            <CardFooter className="flex justify-between items-center">
                <Button variant="ghost" size="sm" onClick={() => navigate(`/note/${item.noteId}`)}>
                    원본 노트 보기
                </Button>
                <div>
                    <Button variant="destructive" size="icon" onClick={onDelete} className="mr-2">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button onClick={handleReveal} disabled={!selected || revealed}>
                        {revealed ? (selected === item.answer ? '정답!' : '오답!') : '확인'}
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
};

export default function ReviewDeckPage() {
    const { todaysReviewItems, updateReviewItem, deleteReviewItem, addReviewItems } = useNotes();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [files, setFiles] = useState<File[]>([]);
    const [progressMessage, setProgressMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleNext = (wasCorrect: boolean) => {
        const currentItem = todaysReviewItems[currentIndex];
        updateReviewItem(currentItem.id, wasCorrect);
        setTimeout(() => {
            setCurrentIndex(i => i + 1);
        }, 1200);
    };
    
    const handleDelete = () => {
        const currentItem = todaysReviewItems[currentIndex];
        deleteReviewItem(currentItem.id);
        setCurrentIndex(i => i + 1);
    };

    const handleFiles = async (incomingFiles: FileList | null, setter: React.Dispatch<React.SetStateAction<File[]>>) => {
        if (!incomingFiles) return;
        const newFiles = Array.from(incomingFiles);

        for (const file of newFiles) {
            if (file.type === 'application/pdf') {
                setProgressMessage('PDF를 이미지로 변환 중...');
                try {
                    const images = await convertPdfToImages(file, (progress) => {
                        setProgressMessage(`PDF 변환 중... (${progress.pageNumber}/${progress.totalPages})`);
                    });
                    setter(prev => [...prev, ...images]);
                } catch (err) {
                    setError('PDF 변환에 실패했습니다.');
                    console.error(err);
                } finally {
                    setProgressMessage(null);
                }
            } else {
                setter(prev => [...prev, file]);
            }
        }
    };

    const removeFile = (index: number, setter: React.Dispatch<React.SetStateAction<File[]>>) => {
        setter(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (files.length === 0) {
            setError("복습 노트를 생성할 파일을 업로드해주세요.");
            return;
        }
        setError(null);
        setProgressMessage('파일 업로드 중...');

        try {
            const blobResults = await Promise.all(
                files.map(file => 
                  upload(file.name, file, {
                    access: 'public',
                    handleUploadUrl: '/api/upload/route',
                  })
                )
            );

            setProgressMessage('AI가 복습 노트를 생성하고 있습니다...');

            const response = await fetch('/api/create_review_note', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ blobUrls: blobResults.map(b => b.url) })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || '복습 노트 생성에 실패했습니다.');
            }

            const newItems = await response.json();
            addReviewItems(newItems);

            setProgressMessage(null);
            setFiles([]);
            alert("AI 복습 노트 생성이 완료되었습니다!");
            setCurrentIndex(0); // Start review from the beginning

        } catch (error) {
            setProgressMessage(null);
            setError(error instanceof Error ? error.message : '파일 업로드 또는 노트 생성 중 오류가 발생했습니다.');
        }
    };

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
                handleFiles(e.dataTransfer.files, setFiles);
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
                <input id={inputId} type="file" multiple onChange={(e) => { handleFiles(e.target.files, setFiles); e.target.value = ''; }} className="hidden" />
            </>
        );
    };

    const currentItem = todaysReviewItems && todaysReviewItems[currentIndex];
    const isLoading = progressMessage !== null;

    return (
        <>
            {isLoading && <LoadingOverlay message={progressMessage as string} />}
            <div className="p-4 sm:p-8 flex flex-col items-center w-full">
                <h1 className="text-3xl font-bold mb-6">오늘의 복습</h1>
                {(todaysReviewItems || []).length > 0 ? (
                    currentItem ? (
                        <ReviewCard item={currentItem} onAnswer={handleNext} onDelete={handleDelete} />
                    ) : (
                        <div className="text-center text-muted-foreground mt-16">
                            <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
                            <h2 className="text-2xl font-semibold">오늘의 복습을 모두 마쳤습니다!</h2>
                            <p>내일 다시 확인해주세요.</p>
                        </div>
                    )
                ) : (
                    <div className="text-center text-muted-foreground mt-8 w-full max-w-4xl">
                        <p className="mb-6">오늘 복습할 항목이 없습니다.</p>
                        
                        <Card className="text-left">
                            <CardHeader>
                                <CardTitle>AI 복습 노트 생성</CardTitle>
                                <CardDescription>강의 자료나 필기 노트를 업로드하면 AI가 자동으로 복습 퀴즈를 만들어줍니다.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <FileUploadArea files={files} setFiles={setFiles} inputId="review-file-upload" />
                                {error && <p className="text-center text-destructive text-sm mt-4">{error}</p>}
                            </CardContent>
                            <CardFooter>
                                <Button size="lg" onClick={handleSubmit} disabled={isLoading || files.length === 0} className="w-full">
                                    <BrainCircuit className="mr-2 h-5 w-5"/>
                                    {isLoading ? "AI 분석 중..." : "복습 노트 생성"}
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                )}
            </div>
        </>
    );
}
