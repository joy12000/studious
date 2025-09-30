// src/components/FileViewer.tsx

import React, { useEffect, useState } from 'react';
import { Attachment } from '../lib/types';
import MarkdownRenderer from './MarkdownRenderer';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// PDF.js worker 설정
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface FileViewerProps {
  attachment: Attachment | null;
}

const FileViewer: React.FC<FileViewerProps> = ({ attachment }) => {
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;

    if (attachment?.type === 'file' && attachment.mimeType === 'application/pdf' && attachment.data instanceof ArrayBuffer) {
      const blob = new Blob([attachment.data], { type: attachment.mimeType });
      objectUrl = URL.createObjectURL(blob);
      setPdfUrl(objectUrl);
    } else {
      setPdfUrl(null);
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [attachment]);

  useEffect(() => {
    if (attachment?.type === 'file' && attachment.mimeType === 'text/markdown' && attachment.data instanceof ArrayBuffer) {
      const blob = new Blob([attachment.data], { type: attachment.mimeType });
      const reader = new FileReader();
      reader.onload = (e) => setMarkdownContent(e.target?.result as string);
      reader.readAsText(blob);
    } else {
      setMarkdownContent(null);
    }
  }, [attachment]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  if (!attachment || attachment.type !== 'file') {
    return (
      <div className="flex items-center justify-center h-full bg-muted rounded-lg">
        <p className="text-muted-foreground">미리 볼 파일을 선택하세요.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[60vh] border rounded-lg overflow-auto p-4 bg-background">
      {pdfUrl && (
        <Document file={pdfUrl} onLoadSuccess={onDocumentLoadSuccess}>
          {Array.from(new Array(numPages), (el, index) => (
            <Page key={`page_${index + 1}`} pageNumber={index + 1} />
          ))}
        </Document>
      )}

      {attachment.mimeType === 'text/markdown' && markdownContent && (
        <div className="prose dark:prose-invert max-w-none">
          <MarkdownRenderer content={markdownContent} />
        </div>
      )}

      {!['application/pdf', 'text/markdown'].includes(attachment.mimeType) && (
        <div className="flex flex-col items-center justify-center h-full">
            <p className="text-muted-foreground">이 파일 형식은 미리보기를 지원하지 않습니다.</p>
            <p className="text-sm text-muted-foreground mt-2">파일 이름: {attachment.name}</p>
        </div>
      )}
    </div>
  );
};

export default FileViewer;