// src/components/NoteCard.tsx
import React, { useMemo } from 'react'; // GEMINI: useMemo 임포트
import { Star, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Note } from '../lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface NoteCardProps {
  note: Note;
  onToggleFavorite?: (id: string) => void;
  view?: 'grid' | 'list';
}

// GEMINI: HTML에서 순수 텍스트를 추출하는 헬퍼 함수
function extractTextFromHTML(html: string): string {
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
}

/**
 * AIBOOK-UI: shadcn/ui의 Card 컴포넌트를 기반으로 새롭게 디자인된 노트 카드입니다.
 * GEMINI: 'list' 뷰 모드를 지원하고, 미리보기 시 HTML 태그를 제거하도록 수정되었습니다.
 */
export default function NoteCard({ note, onToggleFavorite, view = 'grid' }: NoteCardProps) {
  
  // GEMINI: note.content에서 HTML 태그를 제거한 미리보기용 텍스트를 생성합니다.
  const previewText = useMemo(() => extractTextFromHTML(note.content), [note.content]);

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
      <Card className="flex w-full flex-row items-start gap-4 p-4 transition-all hover:shadow-md">
        <div className="flex-1">
          <Link to={`/note/${note.id}`}>
            <h2 className="mb-2 line-clamp-1 text-lg font-semibold">{note.title || '제목 없음'}</h2>
          </Link>
          <Link to={`/note/${note.id}`} className="block">
            <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
              {previewText}
            </p>
          </Link>
          {Array.isArray(note.topics) && note.topics.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {note.topics.map((t: string) => (
                <Badge key={t} variant="secondary">{t}</Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
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
          {note.sourceUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={openSource}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              원본
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // 기본 'grid' 뷰 레이아웃
  return (
    <Card className="flex h-full flex-col transition-all hover:shadow-md">
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

      <CardContent className="flex-1 pb-4">
        <Link to={`/note/${note.id}`} className="block">
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {previewText}
          </p>
        </Link>
      </CardContent>

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
