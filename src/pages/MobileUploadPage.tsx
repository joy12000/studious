import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, UploadCloud, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MobileUploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('먼저 파일을 선택해주세요.');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/add-synced-media', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || '업로드에 실패했습니다.');
      }

      const result = await response.json();
      toast.success(`업로드 성공! PC에서 확인하세요.\nURL: ${result.url}`);
      setSelectedFile(null); // Reset after successful upload

    } catch (error) {
      console.error("Upload failed:", error);
      toast.error(`업로드 중 오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold mb-4">모바일에서 업로드</h1>
        <p className="text-muted-foreground mb-8">사진을 찍거나 파일을 선택하여 PC의 Studious 채팅창으로 보내세요.</p>
        
        <div 
          className="w-full min-h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground cursor-pointer transition-colors p-6 hover:bg-muted/50"
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <UploadCloud className="h-12 w-12 mb-4" />
          {selectedFile ? (
            <p className="font-semibold text-primary">{selectedFile.name}</p>
          ) : (
            <p className="font-semibold">파일을 선택하려면 여기를 클릭하세요</p>
          )}
          <input id="file-input" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        </div>

        <Button 
          onClick={handleUpload} 
          size="lg" 
          className="w-full mt-8"
          disabled={isUploading || !selectedFile}
        >
          {isUploading ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <UploadCloud className="mr-2 h-5 w-5" />
          )}
          {isUploading ? '업로드 중...' : 'PC로 전송'}
        </Button>
      </div>
    </div>
  );
}
