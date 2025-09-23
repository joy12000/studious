import React from 'react';
import { Star, ExternalLink, Youtube, BrainCircuit, Notebook, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Note } from '../lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import NotePreviewThumbnail from './NotePreviewThumbnail';

interface NoteCardProps {
  note: Note;
  onToggleFavorite?: (id: string) => void;
  view?: 'grid' | 'list';
}

const NoteTypeIcon = ({ type }: { type: Note['noteType'] }) => {
    const iconMap = {
        general: <Youtube className="h-4 w-4" />,
        review: <Notebook className="h-4 w-4" />,
        textbook: <BrainCircuit className="h-4 w-4" />,
        assignment: <FileText className="h-4 w-4" />,
    };
    return (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {iconMap[type] || <Notebook className="h-4 w-4" />}
            <span className="capitalize">{type}</span>
        </div>
    );
};

// A simple content cleaner for previews
const cleanContentForPreview = (content: string) => {
    return content
        .replace(/(\*\*|__)(.*?)\1/g, '$2') // Bold
        .replace(/(\*|_)(.*?)\1/g, '$2')   // Italic
        .replace(/`{1,3}[^`]*`{1,3}/g, '')    // Code blocks
        .replace(/#{1,6}\s/g, '')           // Headers
        .replace(/!?\[(.*?)\]\(.*\)/g, '$1') // Links and images
        .replace(/\n/g, ' ');                 // Newlines
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

  if (view === 'list') {
    // List view remains largely the same for a more detailed look
    return (
      <Card className="w-full transition-all hover:shadow-md relative overflow-hidden">
        <div className="flex flex-row items-start gap-4 p-4">
          <div className="flex-1 min-w-0">
            <Link to={`/note/${note.id}`} className="block mb-2">
              <h2 className="line-clamp-2 text-base font-semibold leading-snug hover:text-primary">{note.title || '제목 없음'}</h2>
            </Link>
            <p className="line-clamp-3 text-xs text-muted-foreground">
                {cleanContentForPreview(note.content)}
            </p>
          </div>
          <Link to={`/note/${note.id}`} className="block flex-shrink-0 w-28 sm:w-36 aspect-video rounded-md overflow-hidden bg-muted">
            {thumbnailUrl ? (
                <img src={thumbnailUrl} alt={note.title} className="h-full w-full object-cover"/>
            ) : (
                <NotePreviewThumbnail title={note.title} />
            )}
          </Link>
        </div>
        <div className="flex items-center justify-between px-4 pb-3 pt-2 bg-muted/50 border-t">
            <NoteTypeIcon type={note.noteType} />
            {note.sourceUrl && (
                <Button variant="ghost" size="icon" onClick={openSource} className="h-8 w-8">
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </Button>
            )}
        </div>
        {onToggleFavorite && (
            <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(note.id); }} className="absolute top-2 right-2 h-7 w-7 bg-background/50 backdrop-blur-sm">
                <Star className={`h-4 w-4 ${note.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
            </Button>
        )}
      </Card>
    );
  }

  // Grid View (New Design)
  return (
    <Link to={`/note/${note.id}`} className="group block">
      <Card className="w-full h-full flex flex-col overflow-hidden transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-1">
        {/* Thumbnail Area */}
        <div className="relative w-full aspect-video bg-muted overflow-hidden">
            {thumbnailUrl ? (
                <img src={thumbnailUrl} alt={note.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            ) : (
                <NotePreviewThumbnail title={note.title} />
            )}
            {onToggleFavorite && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(note.id); }}
                className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
                title={note.favorite ? '즐겨찾기 해제' : '즐겨찾기'}
              >
                <Star className={`h-4 w-4 ${note.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-white/80'}`} />
              </button>
            )}
        </div>

        {/* Text & Footer Area */}
        <div className="p-3 flex-grow flex flex-col">
            <h3 className="text-sm font-semibold leading-snug line-clamp-2 mb-1 h-[2.5em]">{note.title || '제목 없음'}</h3>
            <p className="text-xs text-muted-foreground flex-grow overflow-hidden line-clamp-2">
              {cleanContentForPreview(note.content)}
            </p>
            <div className="flex items-center justify-between mt-2 pt-2 border-t">
                <NoteTypeIcon type={note.noteType} />
            </div>
        </div>
      </Card>
    </Link>
  );
}