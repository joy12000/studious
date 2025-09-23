import React from 'react';
import { Star, ExternalLink, Youtube, BrainCircuit, Notebook } from 'lucide-react';
import { Link } from 'react-router-dom';
import { marked } from 'marked';
import type { Note } from '../lib/types';
import { generatePastelColorFromText } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import NotePreviewThumbnail from './NotePreviewThumbnail';

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
            </div>
        </div>
        {onToggleFavorite && (
            <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(note.id); }} className="absolute top-2 right-2 h-7 w-7">
                <Star className={`h-4 w-4 ${note.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
            </Button>
        )}
      </Card>
    );
  }

  // Grid View - A4-like vertical format
  if (note.sourceType === 'youtube' && thumbnailUrl) {
    return (
      <Link to={`/note/${note.id}`} className="group block relative aspect-video w-full">
        <img 
          src={thumbnailUrl} 
          alt={note.title} 
          className="h-full w-full object-cover rounded-lg transition-all duration-300 group-hover:shadow-xl"
        />
        {onToggleFavorite && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(note.id); }}
            className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
            title={note.favorite ? '즐겨찾기 해제' : '즐겨찾기'}
          >
            <Star className={`h-4 w-4 ${note.favorite ? 'fill-yellow-400' : 'text-white/80'}`} />
          </button>
        )}
      </Link>
    )
  }

  return (
    <Link to={`/note/${note.id}`} className="group block">
      <Card className="w-full h-full flex flex-col overflow-hidden transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-1 aspect-[1/1.414]">
        <CardHeader className="p-4 relative">
          <CardTitle className="text-base font-semibold leading-snug line-clamp-2 h-[3em]">{note.title || '제목 없음'}</CardTitle>
          {onToggleFavorite && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(note.id); }}
              className="absolute top-3 right-3 h-7 w-7 flex items-center justify-center rounded-full bg-background/40 text-foreground backdrop-blur-sm transition-colors hover:bg-background/60"
              title={note.favorite ? '즐겨찾기 해제' : '즐겨찾기'}
            >
              <Star className={`h-4 w-4 ${note.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
            </button>
          )}
        </CardHeader>
        <CardContent className="p-4 pt-0 flex-grow overflow-hidden">
            <div 
              className="prose prose-xs dark:prose-invert text-muted-foreground w-full h-full overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: marked(note.content) as string }}
            />
        </CardContent>
        <div className="flex items-center justify-between p-4 pt-0">
            <NoteTypeIcon type={note.noteType} />
            {note.sourceType === 'youtube' && note.subjectId && (
                <div
                    className="px-2 py-0.5 text-xs font-semibold rounded-full shadow-lg text-white"
                    style={{ backgroundColor: generatePastelColorFromText(note.subjectId || '') }}
                >
                    {note.subjectId}
                </div>
            )}
        </div>
      </Card>
    </Link>
  );
}
