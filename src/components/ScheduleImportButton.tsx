
import React, { useRef, useState } from 'react';
import { Upload, Calendar } from 'lucide-react';
import { useNotes } from '../lib/useNotes';
import { Button } from './ui/button';

export default function ScheduleImportButton() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addScheduleFromImage } = useNotes();
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);

    await addScheduleFromImage({
      file,
      onProgress: (status) => {
        // You could show a more detailed status to the user
        console.log('Import Progress:', status);
      },
      onComplete: (events) => {
        setIsLoading(false);
        alert(`${events.length}개의 시간표 항목을 성공적으로 가져왔습니다!`);
        // Reload to see the changes
        window.location.reload();
      },
      onError: (error) => {
        setIsLoading(false);
        console.error('Schedule import failed:', error);
        alert(`시간표 가져오기 실패: ${error}`);
      },
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*,application/pdf"
        className="hidden"
        disabled={isLoading}
      />
      <Button
        onClick={handleClick}
        disabled={isLoading}
        variant="secondary" 
        size="lg" 
        className="w-full rounded-full shadow-lg"
      >
        <Calendar className="h-5 w-5 mr-3" />
        {isLoading ? '처리 중...' : '시간표 이미지 선택'}
      </Button>
    </>
  );
}
