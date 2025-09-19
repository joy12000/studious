import React, { useEffect } from 'react';
import { X, Download, Share2 } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void; // PIN is no longer needed
  onDownload: () => void; // PIN is no longer needed
  noteTitle: string;
}

export default function ShareModal({ isOpen, onClose, onConfirm, onDownload, noteTitle }: ShareModalProps) {

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">노트 공유 및 내보내기</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>
        
        <p className="text-gray-600 mb-6 text-center">
          "<strong className="truncate max-w-xs inline-block align-bottom">{noteTitle}</strong>" 노트를 공유하거나 파일로 다운로드하시겠습니까?
        </p>

        <div className="mt-6 space-y-3">
          <button
            onClick={onConfirm}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Share2 size={18} />
            공유 시작
          </button>
          <button
            onClick={onDownload}
            className="w-full bg-gray-600 text-white font-bold py-3 rounded-lg hover:bg-gray-700 transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Download size={18} />
            파일만 다운로드
          </button>
        </div>
      </div>
    </div>
  );
}