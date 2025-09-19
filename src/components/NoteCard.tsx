import React from 'react';
import { Star, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { marked } from 'marked';
import type { Note } from '../lib/types';
import { generatePastelColorFromText } from '../lib/utils'; // 🚀 GEMINI: 색상 생성 함수 임포트
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface NoteCardProps {
  note: Note;
  onToggleFavorite?: (id: string) => void;
  view?: 'grid' | 'list';
}

/**
 * AIBOOK-UI: shadcn/ui의 Card 컴포넌트를 기반으로 새롭게 디자인된 노트 카드입니다.
 * GEMINI: 'list' 뷰 모드를 지원하고, 태그에 동적 색상을 적용하도록 수정되었습니다.
 */
export default function NoteCard({ note, onToggleFavorite, view = 'grid' }: NoteCardProps) {
  
  // GEMINI: sourceUrl에서 YouTube 썸네일 URL을 동적으로 생성합니다.
  const getYoutubeThumbnailUrl = (youtubeUrl: string): string | null => {
    if (!youtubeUrl) return null;
    const match = youtubeUrl.match(/(?:v=|\/|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
    const videoId = match ? match[1] : null;
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  };

  const thumbnailUrl = note.sourceType === 'youtube' && note.sourceUrl 
    ? getYoutubeThumbnailUrl(note.sourceUrl)
    : null;

  // 원본 URL을 여는 함수 (기존 로직 유지)
  const openSource = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!note.sourceUrl) return;
    const url: string = note.sourceUrl;
    const vidMatch = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
    const vid = vidMatch ? vidMatch[1] : null;
    const deep = vid ? `vnd.youtube://watch?v=${vid}` : url;
    const fallback = () => window.open(url, '_blank');
    let used = false;
    const t = setTimeout(() => { if (!used) fallback(); }, 350);
    try {
      (window as any).location.href = deep;
      used = true;
    } catch (err) {
      console.error('Failed to open deep link:', err);
    }
    setTimeout(()=>clearTimeout(t), 2000);
  };

  // 'list' 뷰일 때의 카드 레이아웃
  if (view === 'list') {
    return (
      <Card className="w-full transition-all hover:shadow-md">
        <div className="flex flex-row items-start gap-4 p-4">
          {/* 왼쪽 컨텐츠 영역 */}
          <div className="flex-1">
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

          {/* 오른쪽 썸네일 영역 */}
          {thumbnailUrl && (
            <Link to={`/note/${note.id}`} className="block flex-shrink-0">
              <img 
                src={thumbnailUrl} 
                alt={note.title} 
                className="aspect-video w-32 rounded-md object-cover sm:w-40"
              />
            </Link>
          )}
        </div>

        {/* 하단 태그 및 버튼 영역 */}
        <div className="flex items-center justify-between px-4 pb-3 pt-2">
          {note.tag ? (
            <div
              className="px-2.5 py-0.5 text-xs font-semibold rounded-full"
              style={generatePastelColorFromText(note.tag)}
            >
              {note.tag}
            </div>
          ) : <div />} {/* 태그가 없을 때 공간을 차지하기 위한 빈 div */}
          
          <div className="flex items-center gap-1">
            {note.sourceUrl && (
              <Button variant="ghost" size="icon" onClick={openSource} className="h-8 w-8">
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
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

  // 기본 'grid' 뷰 레이아웃
  return (
    <Link to={`/note/${note.id}`} className="group relative block w-full aspect-video overflow-hidden rounded-lg shadow-md transition-all hover:shadow-xl hover:-translate-y-1">
      {/* 썸네일 이미지 */}
      <img 
        src={thumbnailUrl || 'https://via.placeholder.com/480x270.png?text=No+Image'} 
        alt={note.title} 
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      
      {/* 썸네일 위에 올라가는 컨텐츠 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent p-2 flex flex-col justify-between">
        {/* 상단: 태그와 즐겨찾기 버튼 */}
        <div className="flex items-start justify-between">
          {note.tag ? (
            <div
              className="px-2 py-0.5 text-xs font-semibold rounded-full shadow-lg"
              style={generatePastelColorFromText(note.tag)}
            >
              {note.tag}
            </div>
          ) : <div />} {/* 빈 공간 유지 */}

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

        {/* 하단: 빈 공간 (미래에 제목 등을 추가할 수 있음) */}
        <div></div>
      </div>
    </Link>
  );
}