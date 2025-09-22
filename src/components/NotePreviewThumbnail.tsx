import React from 'react';
import { generatePastelColorFromText } from '../lib/utils';

interface NotePreviewThumbnailProps {
  title: string;
  content: string;
}

const NotePreviewThumbnail: React.FC<NotePreviewThumbnailProps> = ({ title, content }) => {
  const bgColor = generatePastelColorFromText(title);

  // Remove markdown for a cleaner preview
  const cleanContent = content
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // Bold
    .replace(/(\*|_)(.*?)\1/g, '$2')   // Italic
    .replace(/`{1,3}[^`]*`{1,3}/g, '')    // Code blocks
    .replace(/#{1,6}\s/g, '')           // Headers
    .replace(/!?\[(.*?)\]\(.*\)/g, '$1') // Links and images
    .replace(/\n/g, ' ');                 // Newlines

  return (
    <div 
      className="w-full h-full p-4 flex flex-col justify-center items-center text-white text-center overflow-hidden"
      style={{ backgroundColor: bgColor }}
    >
      <h3 className="font-bold text-lg leading-tight line-clamp-2 mb-2 shadow-sm">{title || '제목 없음'}</h3>
      <p className="text-xs line-clamp-3 opacity-90">{cleanContent}</p>
    </div>
  );
};

export default NotePreviewThumbnail;
