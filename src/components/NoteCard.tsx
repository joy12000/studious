import React from 'react';
import { Star, ExternalLink, Youtube, BrainCircuit, Notebook, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { marked } from 'marked';
import type { Note } from '../lib/types';
import { generatePastelColorFromText } from '../lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import NotePreviewThumbnail from './NotePreviewThumbnail';

interface NoteCardProps {
  note: Note;
  onToggleFavorite?: (id: string) => void;
  view?: 'grid' | 'list';
}

const NoteTypeIcon = ({ type }: { type: Note['noteType'] }) => {
    const iconMap = {
        general: <Youtube className="h-3 w-3" />,
        review: <BrainCircuit className="h-3 w-3" />,
        textbook: <BrainCircuit className="h-3 w-3" />,
        assignment: <FileText className="h-3 w-3" />,
    };
    return (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {iconMap[type] || <Notebook className="h-3 w-3" />}
            <span className="capitalize">{type}</span>
        </div>
    );
};

export default function NoteCard({ note, onToggleFavorite, view = 'grid' }: NoteCardProps) {
  
  const getYoutubeThumbnailUrl = (youtubeUrl: string): string | null => {
    if (!youtubeUrl) return null;
    const match = youtubeUrl.match(/(?:v=|\/|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
    const videoId = match ? match[1] : null;
    return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
  };

  const thumbnailUrl = note.sourceType === 'youtube' && note.sourceUrl 
    ? getYoutubeThumbnailUrl(note.sourceUrl)
    : null;

  const openSource = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!note.sourceUrl) return;
    window.open(note.sourceUrl, '_blank', 'noopener,noreferrer');
  };

  // --- List View (기존과 유사하게 유지) ---
  if (view === 'list') {
    return (
      <Card className="w-full transition-all hover:shadow-md relative">
        <div className="flex flex-row items-start gap-4 p-3">
          <div className="flex-1 min-w-0">
            <Link to={`/note/${note.id}`} className="block">
              <h2 className="mb-2 line-clamp-2 text-base font-semibold leading-snug">{note.title || '제목 없음'}</h2>
            </Link>
            <Link to={`/note/${note.id}`} className="block">
              <div 
                className="prose prose-sm dark:prose-invert line-clamp-4 text-xs text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: marked(note.content) as string }}
              />
            </Link>
          </div>
          <Link to={`/note/${note.id}`} className="block flex-shrink-0 w-28 sm:w-36 aspect-video rounded-md overflow-hidden bg-muted">
            {thumbnailUrl ? (
                <img src={thumbnailUrl} alt={note.title} className="h-full w-full object-cover"/>
            ) : (
                <NotePreviewThumbnail title={note.title} content={note.content} />
            )}
          </Link>
        </div>
        <div className="flex items-center justify-between px-4 pb-3 pt-2">
            <NoteTypeIcon type={note.noteType} />
            {note.sourceUrl && (
                <Button variant="ghost" size="icon" onClick={openSource} className="h-8 w-8">
                    {note.sourceType === 'youtube' ? <Youtube className="h-4 w-4 text-muted-foreground" /> : <ExternalLink className="h-4 w-4 text-muted-foreground" />}
                </Button>
            )}
        </div>
        {onToggleFavorite && (
            <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(note.id); }} className="absolute top-2 right-2 h-7 w-7">
                <Star className={`h-4 w-4 ${note.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
            </Button>
        )}
      </Card>
    );
  }

  // --- Grid View (새로운 디자인) ---
  return (
    <Link to={`/note/${note.id}`} className="group block">
      <Card className="w-full flex flex-col overflow-hidden transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-1 aspect-[4/5]">
        {/* 썸네일 영역 */}
        <div className="relative w-full aspect-video bg-muted overflow-hidden">
            {thumbnailUrl ? (
                <img src={thumbnailUrl} alt={note.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            ) : (
                <NotePreviewThumbnail title={note.title} content={note.content} />
            )}
            {onToggleFavorite && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(note.id); }}
                className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
                title={note.favorite ? '즐겨찾기 해제' : '즐겨찾기'}
              >
                <Star className={`h-4 w-4 ${note.favorite ? 'fill-yellow-400' : 'text-white/80'}`} />
              </button>
            )}
        </div>

        {/* 텍스트 영역 */}
        <div className="p-3 flex-grow flex flex-col overflow-hidden">
            <h3 className="text-sm font-bold leading-snug line-clamp-2 mb-1">{note.title || '제목 없음'}</h3>
            {/* 👈 [버그 수정 & 디자인 개선] 스크롤바 방지 및 손글씨 폰트 적용 */}
            <div 
              className="font-handwriting text-xs text-muted-foreground flex-grow overflow-hidden line-clamp-4"
              style={{ wordBreak: 'break-all' }}
            >
              {note.content.replace(/#+\s/g, '').replace(/(\*\*|__)(.*?)\1/g, '$2')}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t">
                <NoteTypeIcon type={note.noteType} />
                {note.subjectId && (
                    <div
                        className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full text-white"
                        style={{ backgroundColor: generatePastelColorFromText(note.subjectId || '') }}
                    >
                        {note.subjectId}
                    </div>
                )}
            </div>
        </div>
      </Card>
    </Link>
  );
}