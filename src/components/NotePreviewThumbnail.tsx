import React from 'react';
import { generatePastelColorFromText } from '../lib/utils';

interface NotePreviewThumbnailProps {
  title: string;
  content?: string; // content는 이제 선택적
  isTitleOnly?: boolean; // 제목만 표시할지 여부를 결정하는 prop
}

const NotePreviewThumbnail: React.FC<NotePreviewThumbnailProps> = ({ title, content, isTitleOnly }) => {
  const { backgroundColor, color: textColor } = generatePastelColorFromText(title);

  const cleanContent = content
    ?.replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/!?\[(.*?)\]\(.*\)/g, '$1')
    .replace(/\n/g, ' ');

  return (
    <div 
      className="w-full h-full p-4 flex flex-col justify-center items-center text-center overflow-hidden"
      style={{ backgroundColor: backgroundColor, color: textColor }}
    >
      <h3 className="font-bold text-base leading-tight line-clamp-3 shadow-sm">{title || '제목 없음'}</h3>
      {!isTitleOnly && (
        <p className="text-[0.6rem] line-clamp-6 opacity-90 mt-2" style={{ color: textColor }}>
            {cleanContent}
        </p>
      )}
    </div>
  );
};

export default NotePreviewThumbnail;