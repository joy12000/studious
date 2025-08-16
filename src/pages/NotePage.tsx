import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../lib/db';
import { Note } from '../lib/types';
import { useNotes } from '../lib/useNotes';
import TopicBadge from '../components/TopicBadge';
import { encryptJSON } from '../lib/crypto';
import { 
  ArrowLeft, 
  Heart, 
  ExternalLink, 
  Calendar, 
  Edit2, 
  Check, 
  X,
  Star,
  Plus,
  Trash2,
  Share2, // SHARE_BUTTON: 아이콘 임포트
  Youtube // YOUTUBE_BUTTON: 아이콘 임포트
} from 'lucide-react';

export default function NotePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toggleFavorite, updateNote, deleteNote } = useNotes();
  
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    if (!id) return;
    
    const loadNote = async () => {
      try {
        const foundNote = await db.notes.get(id);
        if (foundNote) {
          setNote(foundNote);
          setEditContent(foundNote.content);
          setEditTitle(foundNote.title);
        } else {
          navigate('/');
        }
      } catch (error) {
        console.error('Error loading note:', error);
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    loadNote();
  }, [id, navigate]);

  const handleSaveEdit = async () => {
    if (!note || !id) return;
    
    await updateNote(id, {
      title: editTitle.trim(),
      content: editContent.trim()
    });
    
    setNote({ ...note, title: editTitle.trim(), content: editContent.trim() });
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(note?.content || '');
    setEditTitle(note?.title || '');
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!id) return;
    
    if (confirm('이 노트를 정말 삭제하시겠습니까?')) {
      await deleteNote(id);
      navigate('/');
    }
  };

  // SHARE_FILE_FIX: 오류 처리 및 UX가 개선된 파일 공유 핸들러
  const handleShare = async () => {
    if (!note) return;

    // 수동 다운로드 및 비밀번호 복사를 처리하는 함수
    const fallbackShare = (file: File, passphrase: string) => {
      alert('자동 공유가 차단되었거나 지원되지 않습니다.\n수동으로 파일을 다운로드하고 비밀번호를 복사해주세요.');
      
      // 파일 다운로드 링크 생성 및 클릭
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 비밀번호 클립보드 복사
      navigator.clipboard.writeText(passphrase);
      alert(`파일이 다운로드되었습니다.\n비밀번호가 클립보드에 복사되었습니다.\n\n비밀번호: ${passphrase}\n\n이 비밀번호를 파일과 함께 상대방에게 전달해주세요.`);
    };

    try {
      // 1. 사용자에게 4자리 PIN 입력받기
      let passphrase = '';
      while (true) {
        const input = prompt('공유 파일에 사용할 4자리 숫자 암호를 입력하세요:', '');
        // 사용자가 취소한 경우
        if (input === null) {
          alert('공유를 취소했습니다.');
          return;
        }
        // 입력값이 4자리 숫자인지 확인
        if (/^\d{4}$/.test(input)) {
          passphrase = input;
          break;
        }
        alert('잘못된 형식입니다. 반드시 4자리 숫자를 입력해주세요.');
      }

      const payload = await encryptJSON({ 
        title: note.title,
        content: note.content,
        topics: note.topics,
        labels: note.labels,
        sourceUrl: note.sourceUrl,
        sourceType: note.sourceType,
       }, passphrase);
      
      // 2. 암호화된 데이터를 담은 JSON 파일 생성
      const payloadString = JSON.stringify(payload, null, 2);
      const file = new File([payloadString], `${note.title.replace(/[\\/:"*?<>|]/g, '')}.json`, {
        type: 'application/json',
      });

      // 3. Web Share API 지원 여부 확인
      if (navigator.share && navigator.canShare({ files: [file] })) {
        try {
          // 4. 파일 공유 시도
          await navigator.share({
            title: `암호화된 노트 공유: ${note.title}`,
            text: `이 파일을 열려면 비밀번호가 필요합니다.`, 
            files: [file],
          });
          
          // 공유 성공 후 비밀번호 안내
          setTimeout(() => {
            const copy = confirm(`공유가 시작되었습니다.\n\n이제 복호화 비밀번호를 클립보드에 복사하시겠습니까?\n\n비밀번호: ${passphrase}\n\n이 비밀번호를 상대방에게 안전하게 전달해주세요.`);
            if (copy) {
              navigator.clipboard.writeText(passphrase);
              alert('비밀번호가 클립보드에 복사되었습니다.');
            }
          }, 500);

        } catch (error: any) {
          // 공유가 차단되었을 경우(NotAllowedError) fallback 실행
          if (error.name === 'NotAllowedError') {
            console.warn('Share API permission denied, falling back to manual download.');
            fallbackShare(file, passphrase);
          } else {
            // 그 외 다른 공유 에러
            throw error;
          }
        }
      } else {
        // API를 지원하지 않는 경우 fallback 실행
        console.log('Web Share API for files not supported, falling back.');
        fallbackShare(file, passphrase);
      }
    } catch (error) {
      console.error('노트 공유 실패:', error);
      alert('노트를 공유하는 데 실패했습니다.');
    }
  };

  // DEEPLINK_FIX: PC 환경에서도 안정적으로 동작하도록 딥 링크 로직 수정
  const openSource = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!note?.sourceUrl) return;

    const url: string = note.sourceUrl;
    const fallback = () => window.open(url, '_blank', 'noopener,noreferrer');

    // 사용자 기기 정보 확인 (User Agent)
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);

    // 모바일 환경이 아닐 경우(PC 등) 즉시 웹으로 열기
    if (!isIOS && !isAndroid) {
      fallback();
      return;
    }

    // 모바일 환경일 경우 앱으로 열기 시도
    const vidMatch = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/i);
    const vid = vidMatch ? vidMatch[1] : null;
    
    // iOS는 universal link를 위해 일반 https 주소를 사용하고, Android는 custom scheme을 사용합니다.
    const deepLink = isAndroid && vid ? `vnd.youtube://watch?v=${vid}` : url;

    // 앱이 없을 때를 대비하여 일정 시간 후 웹으로 fallback 실행
    const timer = setTimeout(fallback, 500);

    // 페이지가 숨겨지면(앱으로 전환 성공 시) fallback을 취소
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearTimeout(timer);
        window.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);

    // 딥 링크 실행
    window.location.href = deepLink;
  };

  const toggleTodo = async (todoIndex: number) => {
    if (!note || !id) return;
    
    const updatedTodos = [...note.todo];
    updatedTodos[todoIndex] = {
      ...updatedTodos[todoIndex],
      done: !updatedTodos[todoIndex].done
    };
    
    await updateNote(id, { todo: updatedTodos });
    setNote({ ...note, todo: updatedTodos });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '날짜 없음';
    try {
      return new Date(dateStr).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch { return '날짜 오류'; }
  };

  const getSourceIcon = (sourceType: Note['sourceType']) => {
    switch (sourceType) {
      case 'youtube':
        return '🎬';
      case 'book':
        return '📖';
      case 'web':
        return '🌐';
      default:
        return '📝';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">노트를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">노트를 찾을 수 없습니다.</p>
          <Link to="/" className="text-primary hover:text-primary/80">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="p-2 text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-lg font-semibold text-foreground">노트 상세</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* SHARE_BUTTON: 공유 버튼 추가 */}
              <button
                onClick={handleShare}
                className="p-2 text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <Share2 className="h-5 w-5" />
              </button>
              <button
                onClick={() => setEditing(!editing)}
                className="p-2 text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <Edit2 className="h-5 w-5" />
              </button>
              <button
                onClick={() => toggleFavorite(note.id)}
                className={`p-2 rounded-lg transition-colors ${note.favorite ? 'text-destructive hover:bg-destructive/10' : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'}`}
              >
                {note.favorite ? <Heart className="h-5 w-5 fill-current" /> : <Heart className="h-5 w-5" />}
              </button>
              <button
                onClick={handleDelete}
                className="p-2 text-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-card/60 backdrop-blur-lg rounded-2xl shadow-lg border border-card/20 p-8">
          {/* Meta Info */}
          <div className="flex items-center gap-4 mb-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(note.createdAt)}</span>
            </div>
            
            {/* YOUTUBE_BUTTON: 유튜브 링크가 있을 경우 버튼 표시 */}
            {note.sourceType === 'youtube' && note.sourceUrl && (
              <button 
                onClick={openSource}
                className="inline-flex items-center gap-1.5 text-red-600 hover:text-red-700 transition-colors font-medium"
              >
                <Youtube className="h-4 w-4" />
                YouTube에서 열기
              </button>
            )}

            {/* 그 외 웹 링크를 위한 fallback */}
            {note.sourceType !== 'youtube' && note.sourceUrl && (
              <a 
                href={note.sourceUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-primary transition-colors font-medium"
              >
                <ExternalLink className="h-4 w-4" />
                원문 보기
              </a>
            )}
          </div>

          {/* Title */}
          <div className="mb-6">
            {editing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-3xl font-bold text-card-foreground bg-card/60 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
              />
            ) : (
              <h1 className="text-3xl font-bold text-card-foreground mb-2">
                {getSourceIcon(note.sourceType)} {note.title}
              </h1>
            )}
          </div>

          {/* Topics */}
          <div className="flex flex-wrap gap-2 mb-8">
            {note.topics.map((topic) => (
              <TopicBadge key={topic} topic={topic} />
            ))}
          </div>

          {/* Content */}
          <div className="mb-8">
            {editing ? (
              <div>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={15}
                  className="w-full px-4 py-3 border bg-card/60 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent resize-y transition-colors"
                />
                <div className="flex justify-end gap-3 mt-4">
                  <button
                    onClick={handleCancelEdit}
                    className="inline-flex items-center gap-2 px-4 py-2 border bg-card/50 hover:bg-card/80 rounded-lg transition-colors text-sm"
                  >
                    <X className="h-4 w-4" />
                    취소
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors text-sm font-semibold"
                  >
                    <Check className="h-4 w-4" />
                    저장
                  </button>
                </div>
              </div>
            ) : (
              <div className="prose max-w-none">
                <div className="text-card-foreground whitespace-pre-wrap leading-relaxed">
                  {note.content}
                </div>
              </div>
            )}
          </div>

          {/* Highlights */}
          {note.highlights.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                하이라이트
              </h3>
              <div className="space-y-2">
                {note.highlights.map((highlight, index) => (
                  <div key={index} className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                    <div className="text-yellow-700 dark:text-yellow-300">{highlight.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Todo List */}
          {note.todo.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">
                ✅ 할 일
                <span className="text-sm text-muted-foreground font-normal">
                  ({note.todo.filter(t => t.done).length}/{note.todo.length} 완료)
                </span>
              </h3>
              <div className="space-y-2">
                {note.todo.map((todo, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-card/60 rounded-lg">
                    <button
                      onClick={() => toggleTodo(index)}
                      className={`mt-1 w-4 h-4 rounded-sm border-2 flex-shrink-0 flex items-center justify-center transition-colors ${todo.done ? 'bg-primary border-primary text-primary-foreground' : 'border hover:border-primary'}`}
                    >
                      {todo.done && <Check className="h-3 w-3" />}
                    </button>
                    <span className={`flex-1 ${todo.done ? 'line-through text-muted-foreground' : 'text-card-foreground'}`}>
                      {todo.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Labels */}
          {note.labels.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-card-foreground mb-4">라벨</h3>
              <div className="flex flex-wrap gap-2">
                {note.labels.map((label) => (
                  <span
                    key={label}
                    className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-sm"
                  >
                    #{label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}