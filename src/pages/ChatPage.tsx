// src/pages/ChatPage.tsx

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowUp, Loader2, RefreshCw, Copy, Save, ChevronsUpDown, Check, UploadCloud, FileText, X, BookMarked, CalendarDays } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import MarkdownRenderer from '../components/MarkdownRenderer';
import { useNotes, Subject } from '../lib/useNotes';
import { WeekPicker, getWeekNumber } from '../components/WeekPicker';
import { format } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks'; // ✨ dexie-react-hooks 임포트
import { db } from '../lib/db'; // ✨ db 임포트

const models = [
    { id: 'x-ai/grok-4-fast:free', name: '🚀 Grok 4 Fast (최신/대용량)' },
    { id: 'deepseek/deepseek-r1-0528:free', name: '🧠 DeepSeek R1 (강력한 추론)' },
    { id: 'deepseek/deepseek-chat-v3.1', name: '✨ DeepSeek V3.1 (신규)' },
    { id: 'meta-llama/llama-4-maverick:free', name: '🦙 Llama 4 (최신)' },
    { id: 'mistralai/mistral-7b-instruct', name: '💨 Mistral 7B (가볍고 빠름)' },
];

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  followUp?: string[];
}
interface GeminiHistory {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export default function ChatPage() {
  const { addNoteFromChat, allSubjects, addNoteFromTextbook } = useNotes();
  const navigate = useNavigate();

  // ✨ [추가] 데이터베이스에서 학기 시작일 설정 가져오기
  const settings = useLiveQuery(() => db.settings.get('default'));

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [selectedModel, setSelectedModel] = useState(models[0].id);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const [pageState, setPageState] = useState<'upload' | 'chat'>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [isSubjectPopoverOpen, setIsSubjectPopoverOpen] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleNewChat = () => {
    setMessages([]);
    setUploadedFiles([]);
    setSelectedSubject(null);
    setSelectedDate(null);
    setPageState('upload');
  };
  
  const handleCopy = (text: string) => navigator.clipboard.writeText(text);

  const handleSaveToNote = async () => {
    if (messages.length === 0) return;
    const title = prompt("노트의 제목을 입력하세요:", "AI 채팅 기록");
    if (title) {
      try {
        const newNote = await addNoteFromChat(messages, title, uploadedFiles);
        alert("채팅 기록이 노트로 저장되었습니다!");
        navigate(`/note/${newNote.id}`);
      } catch (error) {
        alert("노트 저장에 실패했습니다.");
        console.error(error);
      }
    }
  };

  const sendNewMessage = (text: string) => {
      setInputValue(text);
      const form = document.getElementById('chat-form') as HTMLFormElement;
      if (form) {
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(submitEvent);
      }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() === '' || isLoading) return;

    const userMessage: Message = { id: Date.now(), text: inputValue, sender: 'user' };
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setInputValue('');
    setIsLoading(true);
    setLoadingMessage('AI가 답변을 생각하고 있어요...');

    const history: GeminiHistory[] = currentMessages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history, model: selectedModel }),
      });
      
      if (!response.ok) throw new Error('API 요청 실패');

      const data = await response.json();
      
      const botMessage: Message = {
        id: Date.now() + 1,
        text: data.answer,
        sender: 'bot',
        followUp: data.followUp,
      };
      setMessages(prev => [...prev, botMessage]);

    } catch (error) {
      console.error('API 통신 오류:', error);
      const errorMessage: Message = {
        id: Date.now() + 1,
        text: '죄송합니다, 답변을 생성하는 중 오류가 발생했습니다.',
        sender: 'bot',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };
  
  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleGenerateTextbook = async () => {
    if (uploadedFiles.length === 0 || !selectedSubject) {
      alert('과목과 하나 이상의 파일을 선택해주세요.');
      return;
    }

    setIsLoading(true);
    setLoadingMessage('AI가 자료를 분석하여 참고서를 만들고 있어요...');
    
    const formData = new FormData();
    uploadedFiles.forEach(file => formData.append('files', file));
    
    // ✨ [개선] 설정된 학기 시작일을 기준으로 주차 계산
    const weekInfo = selectedDate 
      ? `${getWeekNumber(selectedDate, settings?.semesterStartDate)}주차 (${format(selectedDate, 'M월 d일')})` 
      : '[N주차]';

    formData.append('subject', selectedSubject.name);
    formData.append('week', weekInfo);
    formData.append('materialTypes', uploadedFiles.map(f => f.type).join(', ') || '[파일]');

    try {
      // 1. AI에게 참고서 내용 생성 요청
      const response = await fetch('/api/create_textbook', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || '참고서 생성에 실패했습니다.');
      }
      
      const data = await response.json();
      
      // 2. 생성된 내용을 바탕으로 새 노트 자동 저장
      setLoadingMessage('생성된 참고서를 노트에 저장하는 중...');
      const noteTitle = `${selectedSubject.name} - ${weekInfo} 참고서`;
      
      const newNote = await addNoteFromTextbook(
        noteTitle,
        data.textbook,
        selectedSubject.id,
        uploadedFiles
      );

      // 3. 생성된 노트 페이지로 즉시 이동
      alert("AI 참고서가 생성되어 노트에 저장되었습니다!");
      navigate(`/note/${newNote.id}`);

    } catch(error) {
        alert(`오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        setIsLoading(false); // 오류 발생 시 로딩 상태 해제
    }
    // 성공 시에는 페이지 이동이 일어나므로 로딩 상태를 해제할 필요 없음
  };

  const currentModelName = models.find(m => m.id === selectedModel)?.name || '모델 선택';

  if (pageState === 'upload') {
    return (
      <div className="flex flex-col h-full w-full bg-card items-center justify-center p-4">
        <div className="w-full max-w-2xl text-center">
            <h1 className="text-2xl font-bold mb-2">AI 참고서 만들기</h1>
            <p className="text-muted-foreground mb-6">PDF, PPT, 이미지, 텍스트 등 학습 자료를 올려주세요. AI가 종합하여 맞춤 참고서를 만들어 드립니다.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Popover open={isSubjectPopoverOpen} onOpenChange={setIsSubjectPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={isSubjectPopoverOpen} className="w-full justify-between">
                            <div className="flex items-center">
                                <BookMarked className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <span className="truncate">{selectedSubject ? selectedSubject.name : "과목 선택"}</span>
                            </div>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        {allSubjects.map((subject) => (
                        <Button
                            key={subject.id} variant="ghost" className="w-full justify-start"
                            onClick={() => {
                                setSelectedSubject(subject);
                                setIsSubjectPopoverOpen(false);
                            }}
                        >
                            <Check className={`mr-2 h-4 w-4 ${selectedSubject?.id === subject.id ? 'opacity-100' : 'opacity-0'}`} />
                            {subject.name}
                        </Button>
                        ))}
                    </PopoverContent>
                </Popover>

                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={isCalendarOpen} className="w-full justify-between">
                            <div className="flex items-center">
                                <CalendarDays className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <span className="truncate">
                                    {selectedDate 
                                        ? `${getWeekNumber(selectedDate, settings?.semesterStartDate)}주차 (${format(selectedDate, "M월 d일")})` 
                                        : "주차 선택 (날짜)"}
                                </span>
                            </div>
                             <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                       <WeekPicker onDateSelect={(date) => {
                           setSelectedDate(date);
                           setIsCalendarOpen(false);
                       }} />
                    </PopoverContent>
                </Popover>
            </div>

            <div 
              className="w-full min-h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors p-6"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="h-12 w-12 mb-4" />
              <p className="font-semibold">파일을 드래그하거나 클릭해서 업로드</p>
              <input ref={fileInputRef} type="file" multiple onChange={onFileChange} className="hidden" />
            </div>

            {uploadedFiles.length > 0 && (
              <div className="mt-6 text-left">
                <h3 className="font-semibold mb-2">업로드된 파일:</h3>
                <ul className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <li key={index} className="flex items-center justify-between bg-muted/50 p-2 rounded-lg text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{file.name}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => removeFile(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-8">
              <Button onClick={handleGenerateTextbook} size="lg" disabled={isLoading || uploadedFiles.length === 0 || !selectedSubject}>
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                {isLoading ? loadingMessage : 'AI 참고서 생성'}
              </Button>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto bg-card border rounded-lg shadow-lg">
      <div className="p-2 sm:p-4 border-b flex justify-between items-center">
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={isPopoverOpen} className="w-[200px] sm:w-[280px] justify-between">
              <span className="truncate">{currentModelName}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] sm:w-[280px] p-0">
            {models.map((model) => (
              <Button
                key={model.id}
                variant="ghost"
                className="w-full justify-start h-auto py-2"
                onClick={() => {
                  setSelectedModel(model.id);
                  setIsPopoverOpen(false);
                }}
              >
                <Check className={`mr-2 h-4 w-4 ${selectedModel === model.id ? 'opacity-100' : 'opacity-0'}`} />
                <span className="whitespace-normal text-left">{model.name}</span>
              </Button>
            ))}
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={handleSaveToNote} disabled={messages.length === 0}>
            <Save className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">노트 저장</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleNewChat}>
            <RefreshCw className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">새 대화</span>
          </Button>
        </div>
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">AI에게 무엇이든 물어보세요!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id}>
                <div className={`flex items-start gap-3 group ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                  {msg.sender === 'bot' && (
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">AI</div>
                  )}
                  <div className={`relative px-4 py-2 rounded-lg max-w-3xl prose dark:prose-invert prose-p:my-0 prose-headings:my-2 ${msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <MarkdownRenderer content={msg.text} />
                    {msg.sender === 'bot' && !isLoading && msg.text && (
                      <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleCopy(msg.text)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {msg.sender === 'bot' && msg.followUp && (
                  <div className="mt-4 ml-11 flex flex-wrap gap-2">
                    {msg.followUp.map((q, i) => (
                      <Button key={i} variant="outline" size="sm" className="h-auto py-1.5" onClick={() => sendNewMessage(q)}>
                        {q}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      <div className="p-4 border-t">
        <form id="chat-form" onSubmit={handleSendMessage} className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isLoading ? loadingMessage : "메시지를 입력하세요..."}
            className="w-full px-4 py-2 border rounded-full focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" className="rounded-full" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
