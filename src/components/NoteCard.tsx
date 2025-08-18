// src/components/NoteCard.tsx
import React from 'react';
import { Star, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Note } from '../lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface NoteCardProps {
  note: Note;
  onToggleFavorite?: (id: string) => void;
}

/**
 * AIBOOK-UI: shadcn/ui의 Card 컴포넌트를 기반으로 새롭게 디자인된 노트 카드입니다.
 * 구조적인 레이아웃과 일관된 디자인 시스템을 적용하여 사용자 경험을 개선합니다.
 */
export default function NoteCard({ note, onToggleFavorite }: NoteCardProps) {
  
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).location.href = deep;
      used = true;
    } catch (err) {
      console.error('Failed to open deep link:', err);
    }
    setTimeout(()=>clearTimeout(t), 2000);
  };

  return (
    <Card className="flex h-full flex-col transition-all hover:shadow-md">
      {/* 카드 헤더: 제목 및 즐겨찾기 버튼 */}
      <CardHeader className="flex-row items-start justify-between gap-4 pb-4">
        <Link to={`/note/${note.id}`} className="flex-1">
          <CardTitle className="line-clamp-2 text-lg">
            {note.title || '제목 없음'}
          </CardTitle>
        </Link>
        {onToggleFavorite && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(note.id); }}
            className="h-8 w-8 flex-shrink-0"
            title={note.favorite ? '즐겨찾기 해제' : '즐겨찾기'}
          >
            <Star className={`h-5 w-5 ${note.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
          </Button>
        )}
      </CardHeader>

      {/* 카드 본문: 노트 내용 */}
      <CardContent className="flex-1 pb-4">
        <Link to={`/note/${note.id}`} className="block">
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {note.content}
          </p>
        </Link>
      </CardContent>

      {/* 카드 푸터: 토픽 배지 및 원본 링크 */}
      <CardFooter className="flex flex-col items-start gap-4">
        {Array.isArray(note.topics) && note.topics.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {note.topics.map((t: string) => (
              <Badge key={t} variant="secondary">{t}</Badge>
            ))}
          </div>
        )}
        {note.sourceUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={openSource}
            className="mt-auto"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            원본 열기
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
