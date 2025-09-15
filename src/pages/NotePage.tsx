import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Note, Attachment } from '../lib/types';
import { useNotes } from '../lib/useNotes';
import ShareModal from '../components/ShareModal';
import AttachmentPanel from '../components/AttachmentPanel';
import { exportEncrypted, exportPlain } from '../lib/backup';
import { v4 as uuidv4 } from 'uuid';
import { marked } from 'marked';
import { 
  ArrowLeft, ExternalLink, Calendar, Edit, Check, X, Star, Trash2, Share2, Youtube
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Helper to format dates robustly
const formatDate = (dateValue: string | number) => {
  if (!dateValue) return '날짜 없음';
  try {
    const date = new Date(dateValue);
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(date);
  } catch { return '날짜 오류'; }
};

export default function NotePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getNote, updateNote, deleteNote } = useNotes(); // getNote 추가
  
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editAttachments, setEditAttachments] = useState<Attachment[]>([]); // GEMINI: 수정용 첨부파일 상태
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;

    const loadNote = async () => {
      try {
        const foundNote = await getNote(id); // db.notes.get(id) -> getNote(id)
        if (foundNote) {
          setNote(foundNote);
          setEditContent(foundNote.content);
          setEditTitle(foundNote.title);
          setEditAttachments(foundNote.attachments || []); // GEMINI: 첨부파일 상태 초기화
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
  }, [id, navigate, getNote]);

  const handleSaveEdit = async () => {
    if (!note || !id) return;
    
    // GEMINI: attachments도 업데이트에 포함
    await updateNote(id, {
      title: editTitle.trim(),
      content: editContent,
      attachments: editAttachments,
      updatedAt: Date.now(), // updatedAt 갱신
    });
    
    setNote(prev => prev ? { ...prev, title: editTitle.trim(), content: editContent.trim(), attachments: editAttachments, updatedAt: Date.now() } : null);
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(note?.content || '');
    setEditTitle(note?.title || '');
    setEditAttachments(note?.attachments || []); // GEMINI: 첨부파일 상태도 원복
    setEditing(false);
  };

  const handleToggleFavorite = () => {
    if (!note) return;
    const newFavState = !note.favorite;
    updateNote(note.id, { favorite: newFavState });
    setNote(prev => prev ? { ...prev, favorite: newFavState } : null);
  };

  const handleDelete = async () => {
    if (!note || !id) return;
    if (window.confirm(`'${note.title}' 노트를 정말 삭제하시겠습니까?`)) {
      await deleteNote(id);
      navigate('/notes');
    }
  };

  const triggerDownload = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleShare = async (pin: string) => {
    if (!note) return;
    try {
      const encryptedNote = await exportEncrypted(pin, [note.id]);
      const shareData = {
        title: `노트 공유: ${note.title}`,
        text: `Aibrary에서 공유된 노트입니다. 파일을 열어 확인하세요.`,
        files: [
          new File([encryptedNote], `${note.title}.enc.json`, { type: 'application/json' })
        ]
      };
      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        alert('이 브라우저에서는 파일 공유를 지원하지 않습니다. 대신 다운로드합니다.');
        triggerDownload(encryptedNote, `${note.title}.enc.json`);
      }
    } catch (error) {
      console.error("Share failed", error);
      alert('공유에 실패했습니다.');
    }
    setIsShareModalOpen(false);
  };

  const handleDownload = async (pin: string) => {
    if (!note) return;
    try {
      const blob = await (pin ? exportEncrypted(pin, [note.id]) : exportPlain([note.id]));
      const fileName = `${note.title.replace(/[^a-z0-9]/gi, '_')}.${pin ? 'enc' : ''}.json`;
      triggerDownload(blob, fileName);
    } catch (error) {
      console.error("Download failed", error);
      alert('다운로드에 실패했습니다.');
    }
    setIsShareModalOpen(false);
  };

  const openSource = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!note?.sourceUrl) return;

    const url: string = note.sourceUrl;
    const fallback = () => window.open(url, '_blank', 'noopener,noreferrer');

    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);

    if (!isIOS && !isAndroid) {
      fallback();
      return;
    }

    const vidMatch = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/i);
    const vid = vidMatch ? vidMatch[1] : null;
    
    const deepLink = isAndroid && vid ? `vnd.youtube://watch?v=${vid}` : url;

    const timer = setTimeout(fallback, 500);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearTimeout(timer);
        window.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);

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


  // GEMINI: 첨부파일 핸들러 (CapturePage와 동일)
  const handleAddLink = () => {
    const url = prompt("추가할 URL을 입력하세요:", "https://");
    if (url) {
      try {
        new URL(url);
        setEditAttachments(prev => [...prev, { id: uuidv4(), type: 'link', url }]);
      } catch {
        alert("유효하지 않은 URL 형식입니다.");
      }
    }
  };

  const handleAddFile = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).map(file => ({
      id: uuidv4(),
      type: 'file' as const,
      name: file.name,
      mimeType: file.type,
      data: file,
    }));
    setEditAttachments(prev => [...prev, ...newFiles]);
  };

  const handleRemoveAttachment = (id: string) => {
    setEditAttachments(prev => prev.filter(att => att.id !== id));
  };


  if (loading) {
    // ... (로딩 UI는 변경 없음) ...
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
    // ... (노트 없음 UI는 변경 없음) ...
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">노트를 찾을 수 없습니다.</p>
          <Link to="/" className="text-primary hover:text-primary/80">홈으로 돌아가기</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col bg-background">
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 p-2 backdrop-blur-lg md:p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="뒤로 가기">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleToggleFavorite} title={note.favorite ? '즐겨찾기 해제' : '즐겨찾기'}>
              <Star className={`h-5 w-5 ${note.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setEditing(v => !v)} title="편집">
              <Edit className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setIsShareModalOpen(true)} title="공유/내보내기">
              <Share2 className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive hover:text-destructive" title="삭제">
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <article className="mx-auto max-w-3xl">
            <div className="mt-8 mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(note.createdAt)}</span>
              </div>
              
              {note.sourceType === 'youtube' && note.sourceUrl && (
                <button onClick={openSource} className="flex items-center gap-1.5 text-red-600 hover:text-red-700 transition-colors font-medium">
                  <Youtube className="h-4 w-4" />
                  YouTube에서 열기
                </button>
              )}

              {note.sourceType !== 'youtube' && note.sourceUrl && (
                <a href={note.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors font-medium">
                  <ExternalLink className="h-4 w-4" />
                  원문 보기
                </a>
              )}
            </div>

            <div className="mb-6">
              {editing ? (
                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full text-3xl font-bold text-foreground bg-transparent border rounded-lg px-3 py-2 focus:ring-2 focus:ring-ring focus:border-transparent transition-colors" />
              ) : (
                <h1 className="mb-2 text-3xl font-bold leading-normal tracking-tight text-foreground md:text-4xl break-words">{note.title}</h1>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-8">
              {note.tag && <Badge variant="secondary">{note.tag}</Badge>}
            </div>

            <div className="mb-8">
              {editing ? (
                <div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)} // dangerouslySetInnerHTML is not for editing
                    className="w-full h-64 bg-transparent border rounded-lg p-2 focus:ring-0 resize-y"
                  />
                  
                  <AttachmentPanel
                    attachments={editAttachments}
                    onAddLink={handleAddLink}
                    onAddFile={handleAddFile}
                    onRemoveAttachment={handleRemoveAttachment}
                  />

                  <div className="flex justify-end gap-3 mt-4">
                    <Button variant="outline" onClick={handleCancelEdit}>
                      <X className="h-4 w-4" />
                      취소
                    </Button>
                    <Button onClick={handleSaveEdit}>
                      <Check className="h-4 w-4" />
                      저장
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="note-content-line-height prose prose-slate max-w-none dark:prose-invert prose-headings:font-semibold leading-relaxed" 
                       dangerouslySetInnerHTML={{ __html: marked(note.content) as string }} />

                  {/* 🚀 핵심 인사이트 섹션 추가 */}
                  {note.key_insights && note.key_insights.length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        💡 핵심 인사이트
                      </h3>
                      <div className="space-y-3">
                        {note.key_insights.map((insight, index) => (
                          <div key={index} className="flex items-start gap-3 p-4 bg-primary/5 border-l-4 border-primary/40 rounded-r-lg">
                            <div className="text-primary font-bold mt-1">{index + 1}.</div>
                            <p className="text-card-foreground m-0" dangerouslySetInnerHTML={{ __html: marked(insight) as string }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <AttachmentPanel
                    attachments={note.attachments || []}
                    readOnly
                  />
                </div>
              )}
            </div>

            {/* ... (하이라이트, 할 일, 라벨 섹션은 변경 없음) ... */}
            {note.highlights.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">✨ 하이라이트</h3>
                <div className="space-y-2">
                  {note.highlights.map((highlight, index) => (
                    <div key={index} className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                      <div className="text-yellow-700 dark:text-yellow-300">{highlight.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {note.todo.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">✅ 할 일<span className="text-sm text-muted-foreground font-normal">({note.todo.filter(t => t.done).length}/{note.todo.length} 완료)</span></h3>
                <div className="space-y-2">
                  {note.todo.map((todo, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <button onClick={() => toggleTodo(index)} className={`mt-1 w-4 h-4 rounded-sm border-2 flex-shrink-0 flex items-center justify-center transition-colors ${todo.done ? 'bg-primary border-primary text-primary-foreground' : 'border hover:border-primary'}`}>
                        {todo.done && <Check className="h-3 w-3" />}
                      </button>
                      <span className={`flex-1 ${todo.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{todo.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {note.labels && note.labels.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">라벨</h3>
                <div className="flex flex-wrap gap-2">
                  {note.labels.map((label) => (<span key={label} className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-sm">#{label}</span>))}
                </div>
              </div>
            )}
          </article>
        </main>
      </div>
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onConfirm={handleShare}
        onDownload={handleDownload}
        noteTitle={note.title}
      />
    </>
  );
}
