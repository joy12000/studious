// src/pages/ReviewDeckPage.tsx
import React, { useState } from 'react';
import { useNotes } from '../lib/useNotes';
import { ReviewItem } from '../lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
    const { todaysReviewItems, updateReviewItem, deleteReviewItem } = useNotes();
    const [currentIndex, setCurrentIndex] = useState(0);

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

    const currentItem = todaysReviewItems && todaysReviewItems[currentIndex];

    return (
        <div className="p-4 sm:p-8 flex flex-col items-center">
            <h1 className="text-3xl font-bold mb-6">오늘의 복습</h1>
            {todaysReviewItems.length > 0 ? (
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
                <div className="text-center text-muted-foreground mt-16">
                    <p>오늘 복습할 항목이 없습니다.</p>
                    <p className="text-sm">AI 복습 노트를 생성하면 자동으로 복습 덱에 추가할 수 있습니다.</p>
                </div>
            )}
        </div>
    );
}