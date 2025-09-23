import { generateFallbackIconDataUrl } from '../lib/utils';

import React, { useState, useEffect } from "react";
import { useNotes } from "../lib/useNotes";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, Youtube, ArrowRight, File, BrainCircuit, AppWindow, Pencil, Check, Trash2, Plus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const LoadingOverlay = ({ message }: { message: string }) => (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="mt-4 text-lg font-semibold">{message}</p>
            <p className="text-muted-foreground">잠시만 기다려주세요.</p>
        </div>
    </div>
);

const HEADLINES = [
  "새로운 지식을 내 것으로",
  "복잡한 정보를 명확하게",
  "학습의 모든 과정을 한 곳에서",
  "AI와 함께 더 깊이있는 학습을",
  "당신의 두 번째 뇌가 되어줄게요"
];

interface ExternalLinkItem {
  id: string;
  name: string;
  url: string;
  iconUrl: string;
  fallbackIconDataUrl: string;
}

const defaultLinks: ExternalLinkItem[] = [
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/', iconUrl: '', fallbackIconDataUrl: generateFallbackIconDataUrl('G') },
  { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai/', iconUrl: '', fallbackIconDataUrl: generateFallbackIconDataUrl('P') },
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chat.openai.com/', iconUrl: '', fallbackIconDataUrl: generateFallbackIconDataUrl('C') },
  { id: 'mathpix', name: 'Mathpix Snip', url: 'https://snip.mathpix.com/', iconUrl: '', fallbackIconDataUrl: generateFallbackIconDataUrl('M') }
];

const LINKS_STORAGE_KEY = 'studious-external-links';

export default function HomePage() {
  const { addNote } = useNotes();
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [headline, setHeadline] = useState(HEADLINES[0]); // Add headline state

  const [externalLinks, setExternalLinks] = useState<ExternalLinkItem[]>([]); // Add externalLinks state
  const [isEditLinks, setIsEditLinks] = useState(false); // Add isEditLinks state

  useEffect(() => { // useEffect for loading links from localStorage
    try {
      const storedLinks = localStorage.getItem(LINKS_STORAGE_KEY);
      if (storedLinks) {
        setExternalLinks(JSON.parse(storedLinks));
      } else {
        setExternalLinks(defaultLinks);
      }
    } catch (error) {
      console.error("Failed to load links from localStorage", error);
      setExternalLinks(defaultLinks);
    }
  }, []);

  const saveLinks = (links: ExternalLinkItem[]) => { // saveLinks function
    setExternalLinks(links);
    localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(links));
  };

  const handleAddLink = () => { // handleAddLink function
    const name = prompt("추가할 사이트의 이름을 입력하세요:");
    if (!name) return;
    const url = prompt(`'${name}'의 전체 주소(URL)를 입력하세요 (https:// 포함):`);
    if (!url) return;

    try {
      const domain = new URL(url).hostname;
      const newLink: ExternalLinkItem = {
        id: crypto.randomUUID(),
        name,
        url,
        iconUrl: '', // Directly use empty string to force fallback for user-added links
        fallbackIconDataUrl: generateFallbackIconDataUrl(name)
      };
      saveLinks([...externalLinks, newLink]);
    } catch (error) {
      alert("유효하지 않은 URL 형식입니다. 'https://'를 포함하여 다시 시도해주세요.");
    }
  };

  const handleDeleteLink = (id: string) => { // handleDeleteLink function
    if (confirm("이 바로가기를 삭제하시겠습니까?")) {
      saveLinks(externalLinks.filter(link => link.id !== id));
    }
  };

  useEffect(() => { // useEffect for headline rotation
    const interval = setInterval(() => {
      setHeadline(prev => {
        const currentIndex = HEADLINES.indexOf(prev);
        const nextIndex = (currentIndex + 1) % HEADLINES.length;
        return HEADLINES[nextIndex];
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleProgress = (status: string) => setLoadingMessage(status);
  const handleComplete = (note: any) => {
    setIsLoading(false);
    navigate(`/note/${note.id}`);
  };
  const handleError = (error: string) => {
    setIsLoading(false);
    alert(`오류가 발생했습니다: ${error}`);
  };

  const handleYoutubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl) return;
    setIsLoading(true);
    setLoadingMessage('YouTube 영상 요약을 시작합니다...');
    await addNote({ youtubeUrl, onProgress: handleProgress, onComplete: handleComplete, onError: handleError });
  };

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const shareUrl = queryParams.get('share_url');
    if (shareUrl) {
      setYoutubeUrl(shareUrl);
      setIsLoading(true);
      setLoadingMessage('공유된 YouTube 영상 요약을 시작합니다...');
      addNote({ 
        youtubeUrl: shareUrl, 
        onProgress: handleProgress, 
        onComplete: (note) => {
          setIsLoading(false);
          navigate(`/note/${note.id}`, { replace: true });
        }, 
        onError: (error) => {
          setIsLoading(false);
          alert(`오류가 발생했습니다: ${error}`);
          navigate('/', { replace: true });
        } 
      });
    }
  }, [location, addNote, navigate]);


  return (
    <>
      {isLoading && <LoadingOverlay message={loadingMessage} />}
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-4 sm:p-8">
        <div className="absolute top-4 right-4 z-10">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" aria-label="외부 도구 바로가기">
                <AppWindow className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60" align="end">
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-1">
                    <h4 className="font-medium text-sm px-2">바로가기</h4>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsEditLinks(!isEditLinks)}>
                        {isEditLinks ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                    </Button>
                </div>
                <div className="grid grid-cols-1">
                  {externalLinks.map(link => (
                    <div key={link.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted group">
                      <img 
                        src={link.iconUrl} 
                        alt={`${link.name} icon`} 
                        className="h-4 w-4" 
                        onError={(e) => { 
                          (e.target as HTMLImageElement).src = link.fallbackIconDataUrl; 
                        }}
                      />
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm truncate">{link.name}</a>
                      {isEditLinks && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteLink(link.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                      )}
                      {!isEditLinks && (
                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </a>
                      )}
                    </div>
                  ))}
                </div>
                {isEditLinks && (
                    <Button variant="outline" size="sm" className="w-full mt-2" onClick={handleAddLink}>
                        <Plus className="h-4 w-4 mr-2" />
                        새 링크 추가
                    </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="w-full max-w-4xl text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            학습의 시작점, Studious
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            AI와 함께 더 스마트하고 효율적으로 학습하세요.
          </p>

          {/* 유튜브 요약 기능은 홈페이지의 핵심 기능으로 유지 */}
          <form onSubmit={handleYoutubeSubmit} className="mt-10 flex items-center gap-2 bg-card border rounded-full p-2 shadow-lg max-w-xl mx-auto">
            <Youtube className="h-5 w-5 text-muted-foreground ml-3 flex-shrink-0" />
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="YouTube 영상 링크를 붙여넣으세요"
              className="flex-grow bg-transparent px-2 py-2 focus:outline-none"
            />
            <Button type="submit" size="icon" className="rounded-full flex-shrink-0">
              <ArrowRight className="h-5 w-5" />
            </Button>
          </form>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-xl mx-auto">
            {/* 다른 기능들은 전용 페이지로 안내하는 카드로 제공 */}
            <Card 
              className="text-left hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              onClick={() => navigate('/chat')}
            >
              <CardHeader>
                <BrainCircuit className="h-8 w-8 text-primary mb-3" />
                <CardTitle>AI 참고서 만들기</CardTitle>
                <CardDescription className="pt-1">PDF, PPT 등 강의 자료로 AI 맞춤 참고서를 만드세요.</CardDescription>
              </CardHeader>
            </Card>
            <Card 
              className="text-left hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              onClick={() => navigate('/review')}
            >
              <CardHeader>
                <File className="h-8 w-8 text-primary mb-3" />
                <CardTitle>AI 복습 노트 생성</CardTitle>
                <CardDescription className="pt-1">학습 자료로 AI가 만드는 핵심 요약과 퀴즈로 복습하세요.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}