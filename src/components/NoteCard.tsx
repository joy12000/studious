import React from 'react';
import { Star, ExternalLink, Youtube, BrainCircuit, Notebook } from 'lucide-react';
import { Link } from 'react-router-dom';
import { marked } from 'marked';
import type { Note } from '../lib/types';
import { generatePastelColorFromText } from '../lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import NotePreviewThumbnail from './NotePreviewThumbnail'; // ✨ [추가] 새로 만든 썸네일 컴포넌트 임포트

interface NoteCardProps {
  note: Note;
  onToggleFavorite?: (id: string) => void;
  view?: 'grid' | 'list';
}

const NoteTypeIcon = ({ type }: { type: Note['noteType'] }) => {
    const iconMap = {
        general: <Notebook className="h-4 w-4" />,
        review: <BrainCircuit className="h-4 w-4" />,
        textbook: <BrainCircuit className="h-4 w-4" />,
    };
    return <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {iconMap[type] || <Notebook className="h-4 w-4" />}
        <span className="capitalize">{type}</span>
    </div>;
};

export default function NoteCard({ note, onToggleFavorite, view = 'grid' }: NoteCardProps) {
  
  const getYoutubeThumbnailUrl = (youtubeUrl: string): string | null => {
    if (!youtubeUrl) return null;
    const match = youtubeUrl.match(/(?:v=|\/|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
    const videoId = match ? match[1] : null;
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  };

  const thumbnailUrl = note.sourceType === 'youtube' && note.sourceUrl 
    ? getYoutubeThumbnailUrl(note.sourceUrl)
    : null;

  const openSource = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!note.sourceUrl) return;
    window.open(note.sourceUrl, '_blank', 'noopener,noreferrer');
  };

  if (view === 'list') {
    return (
      <Card className="w-full transition-all hover:shadow-md">
        <div className="flex flex-row items-start gap-4 p-4">
          <div className="flex-1 min-w-0">
            <Link to={`/note/${note.id}`} className="block">
              <h2 className="mb-2 line-clamp-2 text-lg font-semibold leading-snug">{note.title || '제목 없음'}</h2>
            </Link>
            <Link to={`/note/${note.id}`} className="block">
              <div 
                className="prose prose-sm dark:prose-invert line-clamp-2 text-sm text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: marked(note.content) as string }}
              />
            </Link>
          </div>
          
          <Link to={`/note/${note.id}`} className="block flex-shrink-0 w-32 sm:w-40 aspect-video rounded-md overflow-hidden bg-muted">
            {note.sourceType === 'youtube' && thumbnailUrl ? (
                <img src={thumbnailUrl} alt={note.title} className="h-full w-full object-cover"/>
            ) : (
                <NotePreviewThumbnail title={note.title} content={note.content} />
            )}
          </Link>
        </div>
        <div className="flex items-center justify-between px-4 pb-3 pt-2">
            <NoteTypeIcon type={note.noteType} />
            <div className="flex items-center gap-1">
                {note.sourceUrl && (
                    <Button variant="ghost" size="icon" onClick={openSource} className="h-8 w-8">
                        {note.sourceType === 'youtube' ? <Youtube className="h-4 w-4 text-muted-foreground" /> : <ExternalLink className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                )}
                {onToggleFavorite && (
                    <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(note.id); }} className="h-8 w-8">
                        <Star className={`h-5 w-5 ${note.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                    </Button>
                )}
            </div>
        </div>
      </Card>
    );
  }

  // Grid View
  return (
    <Link to={`/note/${note.id}`} className="group block">
      <div className="relative w-full aspect-video overflow-hidden rounded-lg shadow-md transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-1 bg-muted">
        {note.sourceType === 'youtube' && thumbnailUrl ? (
          <img 
            src={thumbnailUrl} 
            alt={note.title} 
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="transition-transform duration-300 group-hover:scale-105">
            <NotePreviewThumbnail title={note.title} content={note.content} />
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent p-2 flex flex-col justify-between">
            <div className="flex items-start justify-between">
                {note.sourceType === 'youtube' && note.subjectId && (
                    <div
                        className="px-2 py-0.5 text-xs font-semibold rounded-full shadow-lg text-white"
                        style={{ backgroundColor: generatePastelColorFromText(note.subjectId, 0.7) }}
                    >
                        {note.subjectId}
                    </div>
                )}
                {onToggleFavorite && (
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(note.id); }}
                        className="h-8 w-8 flex items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                        title={note.favorite ? '즐겨찾기 해제' : '즐겨찾기'}
                    >
                        <Star className={`h-5 w-5 transition-all ${note.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-white/80'}`} />
                    </button>
                )}
            </div>
            <NoteTypeIcon type={note.noteType} />
        </div>
      </div>
      <div className="mt-2 px-0.5">
        <h3 className="text-sm font-medium text-foreground leading-snug line-clamp-2 h-[2.8em] group-hover:text-primary transition-colors" title={note.title}>
          {note.title || '제목 없음'}
        </h3>
      </div>
    </Link>
  );
}
