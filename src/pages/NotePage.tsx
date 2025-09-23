// src/pages/NotePage.tsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Note, Attachment, Quiz, QuizQuestion } from '../lib/types';
import { useNotes } from '../lib/useNotes';
import ShareModal from '../components/ShareModal';
import AttachmentPanel from '../components/AttachmentPanel';
import { exportPlainSingleNote } from '../lib/backup';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { 
  ArrowLeft, ExternalLink, Calendar, Edit, Check, X, Star, Trash2, Share2, Youtube, BrainCircuit, Bot, ChevronsUpDown, ClipboardCopy, List, MessageSquarePlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChatUI, Message } from '../components/ChatUI';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';


type TextbookSection = {
  title: string;
  content: string;
  id: string;
};

function parseTextbookContent(markdownText: string): TextbookSection[] {
  if (!markdownText) return [];
  
  const sections = markdownText.split(/\n(?=##\s|###\s)/).filter(part => part.trim() !== '');

  return sections.map((sectionText, index) => {
    const lines = sectionText.split('\n');
    const title = lines[0].replace(/^[#\s]+/, '').trim();
    const content = lines.slice(1).join('\n').trim();
    const id = `section-${title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '') || index}`;
    return { title, content, id };
  });
}

const TableOfContents = ({ sections }: { sections: TextbookSection[] }) => {
  const handleScrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Card className="mb-8 bg-muted/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <List className="h-5 w-5" />
          목차
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {sections.map(section => (
            <li key={section.id}>
              <button 
                onClick={() => handleScrollTo(section.id)}
                className="text-primary hover:underline text-left"
              >
                {section.title}
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

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

// --- ⭐ [기능 수정] 대화형 퀴즈 컴포넌트 ---
const QuizComponent = ({ quiz }: { quiz: Quiz }) => {
    const [userAnswers, setUserAnswers] = useState<(string | null)[]>(() => Array(quiz.questions.length).fill(null));
    const [submitted, setSubmitted] = useState(false);

    const handleOptionClick = (questionIndex: number, option: string) => {
        if (submitted) return; // 제출 후에는 변경 불가
        const newAnswers = [...userAnswers];
        newAnswers[questionIndex] = option;
        setUserAnswers(newAnswers);
    };

    const getButtonVariant = (question: QuizQuestion, questionIndex: number, option: string) => {
        if (!submitted) {
            return userAnswers[questionIndex] === option ? 'secondary' : 'outline';
        }
        // 제출 후 스타일
        const isCorrect = option === question.answer;
        const isSelected = userAnswers[questionIndex] === option;

        if (isCorrect) return 'success'; // 정답은 항상 녹색
        if (isSelected && !isCorrect) return 'destructive'; // 내가 선택한 오답은 적색
        return 'outline'; // 나머지
    };
    
    const handleSubmit = () => setSubmitted(true);

    return (
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          📝 퀴즈로 복습하기
        </h3>
        {quiz.questions.map((q, i) => (
          <div key={i} className="mb-6 p-4 border rounded-lg">
            <p className="font-semibold">{i + 1}. {q.question}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
              {q.options.map((opt, j) => (
                <Button 
                  key={j} 
                  variant={getButtonVariant(q, i, opt)}
                  onClick={() => handleOptionClick(i, opt)}
                  className="w-full justify-start text-left h-auto whitespace-normal"
                >
                  {opt}
                </Button>
              ))}
            </div>
          </div>
        ))}
        <div className="text-center mt-6">
            <Button onClick={handleSubmit} disabled={submitted || userAnswers.includes(null)}>
                {submitted ? '채점 완료!' : '정답 확인'}
            </Button>
        </div>
      </div>
    );
};


const externalAiLinks = [
  { name: 'Gemini', url: 'https://gemini.google.com/' },
  { name: 'Perplexity', url: 'https://www.perplexity.ai/' },
  { name: 'ChatGPT', url: 'https://chat.openai.com/' },
];

export default function NotePage() {
  // ... (이하 기존 NotePage 컴포넌트 로직은 이전 답변과 동일) ...
  const { getNote, updateNote, deleteNote, getQuiz, addQuizToReviewDeck } = useNotes(); // 🧠 addQuizToReviewDeck 임포트
  
  const [note, setNote] = useState<Note | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editAttachments, setEditAttachments] = useState<Attachment[]>([]);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [initialChatMessage, setInitialChatMessage] = useState<string | undefined>();
  
  const chatMessagesRef = useRef<Message[]>();

  useEffect(() => {
    if (!id) return;

    const loadNoteAndQuiz = async () => {
      setLoading(true);
      try {
        const foundNote = await getNote(id);
        if (foundNote) {
          setNote(foundNote);
          setEditContent(foundNote.content);
          setEditTitle(foundNote.title);
          setEditAttachments(foundNote.attachments || []);

          if (foundNote.noteType === 'review') {
            const foundQuiz = await getQuiz(foundNote.id);
            if (foundQuiz) {
              setQuiz(foundQuiz);
            }
          }
        } else {
          navigate('/');
        }
      } catch (error) {
        console.error('Error loading note and quiz:', error);
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    loadNoteAndQuiz();
  }, [id, navigate, getNote, getQuiz]);
  
  const textbookSections = useMemo(() => {
    if (note && note.noteType === 'textbook') {
      return parseTextbookContent(note.content);
    }
    return [];
  }, [note]);

  // 🤔 [기능 추가] 섹션별 AI 질문 핸들러
  const handleAskAboutSection = (section: { title: string, content: string }) => {
    const prompt = `아래 내용에 대해 더 쉽게 설명해줘:\n\n--- [섹션: ${section.title}] ---\n${section.content}\n---`;
    setInitialChatMessage(prompt);
    setIsChatOpen(true);
  };


  const handleSaveEdit = async () => {
    if (!note || !id) return;
    
    await updateNote(id, {
      title: editTitle.trim(),
      content: editContent.replace(/\r\n/g, '\n'),
      attachments: editAttachments,
      updatedAt: Date.now(),
    });
    
    setNote(prev => prev ? { ...prev, title: editTitle.trim(), content: editContent.trim(), attachments: editAttachments, updatedAt: Date.now() } : null);
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(note?.content || '');
    setEditTitle(note?.title || '');
    setEditAttachments(note?.attachments || []);
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

  const handleExportToExternalAI = async (url: string) => {
    if (!note) return;

    const noteContent = `--- 학습 노트 본문 ---\n${note.content}`;
    const chatHistory = (chatMessagesRef.current || [])
      .map(msg => `${msg.sender === 'user' ? '사용자' : 'AI'}: ${msg.text}`)
      .join('\n');
    
    const fullContext = `${noteContent}\n\n--- 이전 대화 기록 ---\n${chatHistory}`;

    try {
      await navigator.clipboard.writeText(fullContext);
      alert('노트와 대화 내용이 클립보드에 복사되었습니다. 외부 AI에 붙여넣어 질문을 이어가세요.');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
      alert('클립보드 복사에 실패했습니다.');
    }
  };

  const handleTestUnderstanding = () => {
    if (!note) return;
    const prompt = `다음은 나의 학습 노트 내용이야. 이 내용을 바탕으로 나의 이해도를 테스트할 수 있는 질문 5개를 만들어줘. 질문은 내가 얼마나 깊이 이해했는지 확인할 수 있도록 개념의 연결, 적용, 비판적 사고를 유도하는 질문으로 구성해줘.\n\n--- 학습 노트 ---\n${note.content}`;
    const encodedPrompt = encodeURIComponent(prompt);
    window.open(`https://gemini.google.com/app?q=${encodedPrompt}`, '_blank');
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

  const handleShare = async () => {
    if (!note) return;
    try {
      const noteBlob = await exportPlainSingleNote(note.id);
      const shareData = {
        title: `노트 공유: ${note.title}`,
        text: `studious에서 공유된 노트입니다. 파일을 열어 확인하세요.`,
        files: [
          new File([noteBlob], `${note.title}.json`, { type: 'application/json' })
        ]
      };
      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        alert('이 브라우저에서는 파일 공유를 지원하지 않습니다. 대신 다운로드합니다.');
        triggerDownload(noteBlob, `${note.title}.json`);
      }
    } catch (error) {
      console.error("Share failed", error);
      alert('공유에 실패했습니다.');
    }
    setIsShareModalOpen(false);
  };

  const handleDownload = async () => {
    if (!note) return;
    try {
      const blob = await exportPlainSingleNote(note.id);
      const fileName = `${note.title.replace(/[^a-z0-9]/gi, '_')}.json`;
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
          <p className="text-lg font-semibold mb-2">노트를 찾을 수 없습니다.</p>
          <Link to="/" className="text-primary hover:text-primary/80">홈으로 돌아가기</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-screen w-full overflow-hidden">
        {/* Chat Panel */}
        <div className={`transition-all duration-300 ease-in-out ${isChatOpen ? 'w-full md:w-2/5' : 'w-0'}`}>
          {isChatOpen && <ChatUI 
              noteContext={note?.content ?? ''} 
              onClose={() => {
                setIsChatOpen(false);
                setInitialChatMessage(undefined); // 닫을 때 초기 메시지 초기화
              }} 
              initialMessage={initialChatMessage} 
              messagesRef={chatMessagesRef}
            />}
        </div>
        
        <div className={`flex h-full flex-col bg-background transition-all duration-300 ease-in-out ${isChatOpen ? 'w-full md:w-3/5' : 'w-full'}`}>
            <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 p-2 backdrop-blur-lg md:p-4">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)} aria-label="뒤로 가기">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={handleToggleFavorite} title={note?.favorite ? '즐겨찾기 해제' : '즐겨찾기'}>
                  <Star className={`h-5 w-5 ${note?.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(v => !v)} title="편집">
                  <Edit className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setIsShareModalOpen(true)} title="공유/내보내기">
                  <Share2 className="h-5 w-5" />
                </Button>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" title="외부 AI로 내보내기">
                      <ClipboardCopy className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56" align="end">
                    <div className="space-y-1">
                      <h4 className="font-medium text-sm px-2">다른 AI로 질문하기</h4>
                      <p className="text-xs text-muted-foreground px-2 pb-2">노트와 대화 내용을 복사하여 새 탭에서 엽니다.</p>
                      <div className="grid grid-cols-1">
                        {externalAiLinks.map(link => (
                          <button
                            key={link.name}
                            onClick={() => handleExportToExternalAI(link.url)}
                            className="flex items-center gap-2 p-2 rounded-md hover:bg-muted text-sm text-left w-full"
                          >
                            <img src={`https://www.google.com/s2/favicons?domain=${new URL(link.url).hostname}&sz=32`} alt={link.name} className="h-4 w-4" />
                            {link.name}
                            <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive" title="삭제">
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-8">
              <article className={`mx-auto transition-all duration-300 ease-in-out ${isChatOpen ? 'max-w-full' : 'max-w-3xl'}`}>
                <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(note?.createdAt)}</span>
                  </div>
                  
                  {note?.sourceType === 'youtube' && note?.sourceUrl && (
                    <button onClick={openSource} className="flex items-center gap-1.5 text-red-600 hover:text-red-700 transition-colors font-medium">
                      <Youtube className="h-4 w-4" />
                      YouTube에서 열기
                    </button>
                  )}

                  {note?.sourceType !== 'youtube' && note?.sourceUrl && (
                    <a href={note?.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors font-medium">
                      <ExternalLink className="h-4 w-4" />
                      원문 보기
                    </a>
                  )}
                </div>

                <div className="mb-6">
                  {editing ? (
                    <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full text-3xl font-bold text-foreground bg-transparent border rounded-lg px-3 py-2 focus:ring-2 focus:ring-ring focus:border-transparent transition-colors" />
                  ) : (
                    <h1 className="mb-2 text-3xl font-bold leading-normal tracking-tight text-foreground md:text-4xl break-words">{note?.title}</h1>
                  )}
                </div>

                {note?.sourceType === 'youtube' && (
                  <div className="flex flex-wrap gap-2 mb-8">
                    {note?.subjectId && <Badge variant="secondary">{note?.subjectId}</Badge>}
                  </div>
                )}

                <div className="mb-8">
                  {editing ? (
                    <div>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full h-64 bg-transparent border rounded-lg p-2 focus:ring-0 resize-y"
                      />
                      
                      <AttachmentPanel
                        attachments={editAttachments}
                        onAddLink={() => { /* handleAddLink 구현 필요 */ }}
                        onAddFile={() => { /* handleAddFile 구현 필요 */ }}
                        onRemoveAttachment={() => { /* handleRemoveAttachment 구현 필요 */ }}
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
                        {textbookSections.length > 0 && <TableOfContents sections={textbookSections} />}

                        {textbookSections.length > 0 ? (
                            <div className="space-y-3">
                                {textbookSections.map((section) => (
                                    <details key={section.id} id={section.id} className="group rounded-lg border bg-card p-4">
                                        <summary className="cursor-pointer font-semibold text-lg list-none flex items-center justify-between">
                                            <span>{section.title}</span>
                                            {/* 🤔 [기능 추가] 섹션별 AI 질문 버튼 */}
                                            <div className="flex items-center">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.preventDefault(); handleAskAboutSection(section); }}>
                                                    <MessageSquarePlus className="h-4 w-4" />
                                                </Button>
                                                <span className="text-muted-foreground transition-transform group-open:rotate-90 ml-2">▶</span>
                                            </div>
                                        </summary>
                                        <div className="mt-4 prose prose-lg max-w-none dark:prose-invert prose-p:leading-relaxed">
                                            <MarkdownRenderer content={section.content} />
                                        </div>
                                    </details>
                                ))}
                            </div>
                        ) : (
                            <div className="note-content-line-height prose prose-lg max-w-none dark:prose-invert prose-p:leading-relaxed prose-headings:font-semibold">
                              <MarkdownRenderer content={note?.content} />
                            </div>
                        )}

                      {note?.key_insights && note?.key_insights.length > 0 && (
                        <div className="mt-8">
                          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                            💡 핵심 인사이트
                          </h3>
                          <div className="space-y-3">
                            {note?.key_insights.map((insight, index) => (
                              <div key={index} className="flex items-start gap-3 p-4 bg-primary/5 border-l-4 border-primary/40 rounded-r-lg">
                                <div className="text-primary font-bold mt-1">{index + 1}.</div>
                                <div className="text-card-foreground m-0"><MarkdownRenderer content={insight} /></div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <AttachmentPanel
                        attachments={note?.attachments || []}
                        readOnly
                      />

                      {note?.noteType === 'review' && quiz && <QuizComponent quiz={quiz} />}

                      <div className="mt-8 flex flex-col sm:flex-row gap-2">
                        {/* 🧠 [기능 추가] 복습 덱 추가 버튼 */}
                        {note?.noteType === 'review' && quiz && (
                            <Button onClick={() => addQuizToReviewDeck(note.id)} variant="secondary" className="w-full">
                                <BrainCircuit className="mr-2 h-4 w-4" />
                                이 퀴즈를 복습 덱에 추가
                            </Button>
                        )}
                        <Button onClick={handleTestUnderstanding} variant="outline" className="w-full">
                          나의 이해도 테스트하기
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            </main>
        </div>
      </div>
      
      {!isChatOpen && (
        <Button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 z-20 h-14 w-14 rounded-full shadow-lg"
          title="AI와 대화하기"
        >
          <Bot className="h-7 w-7" />
        </Button>
      )}

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onConfirm={handleShare}
        onDownload={handleDownload}
        noteTitle={note?.title}
      />
    </>
  );
}