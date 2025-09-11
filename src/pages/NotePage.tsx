import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../lib/db';
import { Note, Attachment } from '../lib/types';
import { useNotes } from '../lib/useNotes';
import TopicBadge from '../components/TopicBadge';
import ShareModal from '../components/ShareModal';
import AttachmentPanel from '../components/AttachmentPanel';
import { encryptJSON } from '../lib/crypto';
import { v4 as uuidv4 } from 'uuid';
import { 
  ArrowLeft, Heart, ExternalLink, Calendar, Edit2, Check, X, Star, Trash2, Share2, Youtube
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
  const [editAttachments, setEditAttachments] = useState<Attachment[]>([]); // GEMINI: 수정용 첨부파일 상태
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    
    const loadNote = async () => {
      try {
        const foundNote = await db.notes.get(id);
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
  }, [id, navigate]);

  const handleSaveEdit = async () => {
    if (!note || !id) return;
    
    // GEMINI: attachments도 업데이트에 포함
    await updateNote(id, {
      title: editTitle.trim(),
      content: editContent.trim(),
      attachments: editAttachments,
    });
    
    setNote({ ...note, title: editTitle.trim(), content: editContent.trim(), attachments: editAttachments });
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(note?.content || '');
    setEditTitle(note?.title || '');
    setEditAttachments(note?.attachments || []); // GEMINI: 첨부파일 상태도 원복
    setEditing(false);
  };

  // ... (handleDelete, handleConfirmShare 등 다른 핸들러는 변경 없음) ...
  const handleDelete = async () => {
    if (!id) return;
    
    if (confirm('이 노트를 정말 삭제하시겠습니까?')) {
      await deleteNote(id);
      navigate('/');
    }
  };

  const handleConfirmShare = async (passphrase: string) => {
    if (!note) return;
    setIsShareModalOpen(false);
    const encryptedPayload = await encryptJSON(note, passphrase);
    const shareData = {
      title: note.title,
      text: JSON.stringify(encryptedPayload),
    };
    try {
      await navigator.share(shareData);
    } catch (err) {
      console.error('Share failed:', err);
      alert('노트 공유에 실패했습니다.');
    }
  };

  const handleConfirmDownload = async (passphrase: string) => {
    if (!note) return;
    setIsShareModalOpen(false);
    const encryptedPayload = await encryptJSON(note, passphrase);
    const blob = new Blob([JSON.stringify(encryptedPayload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title.replace(/[^a-z0-9]/gi, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  // ... (formatDate, getSourceIcon 등 헬퍼 함수는 변경 없음) ...
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
      case 'youtube': return '🎬';
      case 'book': return '📖';
      case 'web': return '🌐';
      default: return '📝';
    }
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
          <p className="text-muted-foreground mb-4">노트를 찾을 수 없습니다.</p>
          <Link to="/" className="text-primary hover:text-primary/80">홈으로 돌아가기</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background">
        {/* ... (헤더는 변경 없음) ... */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link to="/" className="p-2 text-foreground hover:bg-muted rounded-lg transition-colors">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
                <div>
                  <h1 className="text-lg font-semibold text-foreground">노트 상세</h1>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button onClick={() => setIsShareModalOpen(true)} className="p-2 text-foreground hover:bg-muted rounded-lg transition-colors">
                  <Share2 className="h-5 w-5" />
                </button>
                <button onClick={() => setEditing(!editing)} className="p-2 text-foreground hover:bg-muted rounded-lg transition-colors">
                  <Edit2 className="h-5 w-5" />
                </button>
                <button onClick={() => toggleFavorite(note.id)} className={`p-2 rounded-lg transition-colors ${note.favorite ? 'text-destructive hover:bg-destructive/10' : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'}`}>
                  {note.favorite ? <Heart className="h-5 w-5 fill-current" /> : <Heart className="h-5 w-5" />}
                </button>
                <button onClick={handleDelete} className="p-2 text-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-card/60 backdrop-blur-lg rounded-2xl shadow-lg border border-card/20 p-8">
            {/* ... (날짜, 소스 정보 등은 변경 없음) ... */}
            <div className="flex items-center gap-4 mb-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(note.createdAt)}</span>
              </div>
              
              {note.sourceType === 'youtube' && note.sourceUrl && (
                <button onClick={openSource} className="inline-flex items-center gap-1.5 text-red-600 hover:text-red-700 transition-colors font-medium">
                  <Youtube className="h-4 w-4" />
                  YouTube에서 열기
                </button>
              )}

              {note.sourceType !== 'youtube' && note.sourceUrl && (
                <a href={note.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-primary transition-colors font-medium">
                  <ExternalLink className="h-4 w-4" />
                  원문 보기
                </a>
              )}
            </div>

            <div className="mb-6">
              {editing ? (
                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full text-3xl font-bold text-card-foreground bg-card/60 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-ring focus:border-transparent transition-colors" />
              ) : (
                <h1 className="text-3xl font-bold text-card-foreground mb-2">{getSourceIcon(note.sourceType)} {note.title}</h1>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-8">
              {note.tag && <TopicBadge topic={note.tag} />}
            </div>

            <div className="mb-8">
              {editing ? (
                <div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-64 bg-transparent border rounded-lg p-2 focus:ring-0 resize-none"
                  />
                  
                  <AttachmentPanel
                    attachments={editAttachments}
                    onAddLink={handleAddLink}
                    onAddFile={handleAddFile}
                    onRemoveAttachment={handleRemoveAttachment}
                  />

                  <div className="flex justify-end gap-3 mt-4">
                    <button onClick={handleCancelEdit} className="inline-flex items-center gap-2 px-4 py-2 border bg-card/50 hover:bg-card/80 rounded-lg transition-colors text-sm">
                      <X className="h-4 w-4" />
                      취소
                    </button>
                    <button onClick={handleSaveEdit} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors text-sm font-semibold">
                      <Check className="h-4 w-4" />
                      저장
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="prose dark:prose-invert max-w-none break-words whitespace-pre-wrap">
                    {note.content}
                  </div>

                  {/* 🚀 핵심 인사이트 섹션 추가 */}
                  {note.key_insights && note.key_insights.length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">
                        <Star className="h-5 w-5 text-yellow-500" />
                        핵심 인사이트
                      </h3>
                      <div className="space-y-3">
                        {note.key_insights.map((insight, index) => (
                          <div key={index} className="flex items-start gap-3 p-4 bg-primary/5 border-l-4 border-primary/50 rounded-r-lg">
                            <div className="text-primary font-bold mt-1">{index + 1}.</div>
                            <p className="text-card-foreground m-0">{insight}</p>
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
                <h3 className="text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2"><Star className="h-5 w-5 text-yellow-500" />하이라이트</h3>
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
                <h3 className="text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">✅ 할 일<span className="text-sm text-muted-foreground font-normal">({note.todo.filter(t => t.done).length}/{note.todo.length} 완료)</span></h3>
                <div className="space-y-2">
                  {note.todo.map((todo, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-card/60 rounded-lg">
                      <button onClick={() => toggleTodo(index)} className={`mt-1 w-4 h-4 rounded-sm border-2 flex-shrink-0 flex items-center justify-center transition-colors ${todo.done ? 'bg-primary border-primary text-primary-foreground' : 'border hover:border-primary'}`}>
                        {todo.done && <Check className="h-3 w-3" />}
                      </button>
                      <span className={`flex-1 ${todo.done ? 'line-through text-muted-foreground' : 'text-card-foreground'}`}>{todo.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {note.labels.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-card-foreground mb-4">라벨</h3>
                <div className="flex flex-wrap gap-2">
                  {note.labels.map((label) => (<span key={label} className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-sm">#{label}</span>))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onConfirm={handleConfirmShare}
        onDownload={handleConfirmDownload}
        noteTitle={note.title}
      />
    </>
  );
}
