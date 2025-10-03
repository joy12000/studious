import { generateFallbackIconDataUrl } from '../lib/utils';
import React, { useState, useEffect } from "react";
import { useNotes } from "../lib/useNotes";
import { useNavigate, useLocation } from "react-router-dom";
import toast from 'react-hot-toast';
import { Loader2, Youtube, ArrowRight, File, BrainCircuit, AppWindow, Pencil, Check, Trash2, Plus, ExternalLink, Book, ChevronsUpDown } from "lucide-react"; // Book 아이콘 추가
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"; // ToggleGroup 컴포넌트 import

interface ExternalLinkItem {
  id: string;
  name: string;
  url: string;
  iconUrl: string;
  fallbackIconDataUrl: string;
}

const defaultLinks: ExternalLinkItem[] = [
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/', iconUrl: 'https://www.google.com/s2/favicons?domain=gemini.google.com&sz=64', fallbackIconDataUrl: generateFallbackIconDataUrl('G') },
  { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai/', iconUrl: 'https://www.google.com/s2/favicons?domain=perplexity.ai&sz=64', fallbackIconDataUrl: generateFallbackIconDataUrl('P') },
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chat.openai.com/', iconUrl: 'https://www.google.com/s2/favicons?domain=openai.com&sz=64', fallbackIconDataUrl: generateFallbackIconDataUrl('C') },
  { id: 'mathpix', name: 'Mathpix Snip', url: 'https://snip.mathpix.com/', iconUrl: 'https://www.google.com/s2/favicons?domain=mathpix.com&sz=64', fallbackIconDataUrl: generateFallbackIconDataUrl('M') }
];

const LINKS_STORAGE_KEY = 'studious-external-links';

export default function HomePage() {
  const { startBackgroundTask } = useNotes();
  const navigate = useNavigate();
  const location = useLocation();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [summaryType, setSummaryType] = useState('default'); // ✨ 요약 타입 상태 추가

  const [externalLinks, setExternalLinks] = useState<ExternalLinkItem[]>([]);
  const [isEditLinks, setIsEditLinks] = useState(false);

  useEffect(() => {
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

  const saveLinks = (links: ExternalLinkItem[]) => {
    setExternalLinks(links);
    localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(links));
  };

  const handleAddLink = () => {
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

  const handleDeleteLink = (id: string) => {
    if (confirm("이 바로가기를 삭제하시겠습니까?")) {
      saveLinks(externalLinks.filter(link => link.id !== id));
    }
  };

  const handleYoutubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl || !youtubeUrl.includes('youtu')) {
      toast.error('올바른 YouTube 링크를 입력해주세요.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await startBackgroundTask({
        noteType: 'youtube_summary',
        payload: { youtubeUrl, summaryType }, // ✨ summaryType을 payload에 추가
      });
      toast.success('YouTube 요약이 백그라운드에서 시작되었습니다!');
      setYoutubeUrl('');
    } catch (error) {
      console.error("YouTube 요약 시작 중 오류 발생:", error);
      toast.error(`요약 시작 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const shareUrl = queryParams.get('share_url');
    if (shareUrl) {
      const processShare = async () => {
        toast.loading('공유된 YouTube 영상 요약을 시작합니다...');
        try {
          await startBackgroundTask({
            noteType: 'youtube_summary',
            payload: { youtubeUrl: shareUrl, summaryType: 'default' }, // 공유 기능은 기본 요약 사용
          });
          toast.dismiss();
          toast.success('백그라운드에서 요약이 시작되었습니다!');
          navigate('.', { replace: true }); // Clear query params
        } catch (error) {
          toast.dismiss();
          toast.error(`요약 시작 중 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
          navigate('.', { replace: true }); // Clear query params
        }
      };
      processShare();
    }
  }, []); // Run only once on mount

  return (
    <>
      <div className="min-h-screen w-full flex flex-col items-center bg-background p-4 sm:p-8">
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

        <div className="flex-grow-[2] flex items-end justify-center">
          <div className="w-full max-w-4xl text-center">
            <h1 className="text-6xl sm:text-8xl font-bold tracking-tight animated-gradient-text py-3">
              STUDIOUS
            </h1>
          </div>
        </div>

        <div className="flex-grow-[1]"></div>

        <div className="w-full max-w-xl text-center">
          <div className="relative flex items-center w-full gap-2 bg-card border rounded-full p-2 shadow-lg">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="rounded-full px-4 py-2 flex-shrink-0">
                  {summaryType === 'lecture' ? '강의 노트' : '일반 요약'}
                  <ChevronsUpDown className="h-4 w-4 ml-2 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-1">
                <ToggleGroup
                  type="single"
                  value={summaryType}
                  onValueChange={(value) => { if (value) setSummaryType(value); }}
                >
                  <ToggleGroupItem value="default" aria-label="일반 요약">
                    <Book className="h-4 w-4 mr-2" /> 일반 요약
                  </ToggleGroupItem>
                  <ToggleGroupItem value="lecture" aria-label="강의 노트">
                    <BrainCircuit className="h-4 w-4 mr-2" /> 강의 노트
                  </ToggleGroupItem>
                </ToggleGroup>
              </PopoverContent>
            </Popover>

            <div className="h-6 w-px bg-border mx-1"></div>

            <form onSubmit={handleYoutubeSubmit} className="flex-grow flex items-center gap-2">
              <Youtube className="h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="YouTube 영상 링크를 붙여넣으세요"
                className="flex-grow bg-transparent focus:outline-none h-10"
              />
              <Button type="submit" size="icon" className="rounded-full flex-shrink-0" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
              </Button>
            </form>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card 
              className="text-left hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              onClick={() => navigate('/textbook')}
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
        <div className="flex-grow-[3]"></div>
      </div>
    </>
  );
}