import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, UploadCloud, CheckCircle, AlertTriangle, X, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@clerk/clerk-react';

export default function MobileUploadPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { userId, getToken } = useAuth();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles(Array.from(event.target.files));
    }
  };

  const handleCameraChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFiles(prev => [...prev, event.target.files![0]]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('먼저 파일을 선택해주세요.');
      return;
    }
    if (!userId || !getToken) {
      toast.error('로그인이 필요합니다. 페이지를 새로고침 해주세요.');
      return;
    }

    setIsUploading(true);
    let allUploadsSuccessful = true;
    const uploadedUrls: string[] = [];

    const token = await getToken({ template: 'supabase' });
    if (!token) {
      toast.error('인증에 실패했습니다. 다시 로그인해주세요.');
      setIsUploading(false);
      return;
    }

    for (const file of selectedFiles) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', userId);

      try {
        const response = await fetch('/api/add-synced-media', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || `파일 ${file.name} 업로드에 실패했습니다.`);
        }

        const result = await response.json();
        uploadedUrls.push(result.url);
        toast.success(`파일 ${file.name} 업로드 성공!`);

      } catch (error) {
        console.error(`Upload failed for ${file.name}:`, error);
        toast.error(`파일 ${file.name} 업로드 중 오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        allUploadsSuccessful = false;
      }
    }

    setIsUploading(false);
    if (allUploadsSuccessful) {
      toast.success(`모든 파일 업로드 완료! PC에서 확인하세요.`);
      setSelectedFiles([]);
    } else {
      toast.error('일부 파일 업로드에 실패했습니다.');
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
          {selectedFiles.length > 0 ? (
            <div className="space-y-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between w-full px-4 py-2 bg-muted rounded-md">
                  <p className="font-semibold text-primary truncate">{file.name}</p>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); removeFile(index); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-semibold">파일을 선택하려면 여기를 클릭하세요</p>
          )}
          <input id="file-input" type="file" accept="image/*" onChange={handleFileChange} className="hidden" multiple />
        </div>

        <Button 
          onClick={handleUpload} 
          size="lg" 
          className="w-full mt-8"
          disabled={isUploading || selectedFiles.length === 0}
        >
          {isUploading ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <UploadCloud className="mr-2 h-5 w-5" />
          )}
          {isUploading ? '업로드 중...' : 'PC로 전송'}
        </Button>

        <input id="camera-input" type="file" accept="image/*" capture="environment" onChange={handleCameraChange} className="hidden" />
        <Button 
          onClick={() => document.getElementById('camera-input')?.click()} 
          size="lg" 
          className="w-full mt-4"
          variant="secondary"
          disabled={isUploading}
        >
          <Camera className="mr-2 h-5 w-5" />
          사진 바로 찍기
        </Button>
      </div>
    </div>
  );
}
