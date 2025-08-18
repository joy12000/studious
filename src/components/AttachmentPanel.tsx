import React from 'react';
import { Attachment } from '../lib/types';
import { Link, Paperclip, X, Download } from 'lucide-react';

type Props = {
  attachments: Attachment[];
  onAddLink?: () => void;
  onAddFile?: (files: FileList | null) => void;
  onRemoveAttachment?: (id: string) => void;
  readOnly?: boolean;
};

const AttachmentItem = ({ attachment, onRemove, readOnly }: { attachment: Attachment; onRemove?: (id: string) => void; readOnly?: boolean; }) => {
  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onRemove) {
      onRemove(attachment.id);
    }
  };

  const handleDownload = (e: React.MouseEvent, fileAttachment: Attachment & { type: 'file' }) => {
    e.preventDefault();
    const url = URL.createObjectURL(fileAttachment.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileAttachment.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (attachment.type === 'link') {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 group"
      >
        <Link className="w-4 h-4 text-slate-500" />
        <span className="flex-1 truncate text-blue-600 dark:text-blue-400">{attachment.url}</span>
        {!readOnly && (
          <button onClick={handleRemove} className="p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-slate-300 dark:hover:bg-slate-600">
            <X className="w-3 h-3" />
          </button>
        )}
      </a>
    );
  }

  if (attachment.type === 'file') {
    const fileSize = (attachment.data.size / 1024).toFixed(1); // in KB
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800 group">
        <Paperclip className="w-4 h-4 text-slate-500" />
        <span className="flex-1 truncate">{attachment.name}</span>
        <span className="text-xs text-slate-500">{fileSize} KB</span>
        {readOnly && (
           <button onClick={(e) => handleDownload(e, attachment)} className="p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-slate-300 dark:hover:bg-slate-600">
            <Download className="w-3 h-3" />
          </button>
        )}
        {!readOnly && (
          <button onClick={handleRemove} className="p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-slate-300 dark:hover:bg-slate-600">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  return null;
};

export default function AttachmentPanel({ attachments, onAddLink, onAddFile, onRemoveAttachment, readOnly = false }: Props) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onAddFile) {
      onAddFile(e.target.files);
    }
    e.target.value = '';
  };

  // GEMINI: 첨부파일이 없으면 아무것도 렌더링하지 않음 (읽기 전용 모드에서)
  if (readOnly && attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">첨부파일</h3>
      <div className="space-y-2">
        {attachments.map(att => (
          <AttachmentItem key={att.id} attachment={att} onRemove={onRemoveAttachment} readOnly={readOnly} />
        ))}
      </div>
      {!readOnly && (
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={onAddLink}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Link className="w-4 h-4" /> 링크 추가
          </button>
          <button
            type="button"
            onClick={handleFileButtonClick}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Paperclip className="w-4 h-4" /> 파일 추가
          </button>
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileSelected}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}
