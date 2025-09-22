import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { ArrowUp, Loader2, RefreshCw, Copy, Save, ChevronsUpDown, Check, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import MarkdownRenderer from './MarkdownRenderer';
import { useNotes } from '../lib/useNotes';

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

// ✨ [개선] Props에 noteContext와 onClose 추가
interface ChatUIProps {
  noteContext: string;
  onClose: () => void;
}

export const ChatUI: React.FC<ChatUIProps> = ({ noteContext, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { addNoteFromChat } = useNotes();
  const navigate = useNavigate();
  
  const [selectedModel, setSelectedModel] = useState(models[0].id);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);
  
  // ✨ [추가] 컴포넌트 마운트 시 첫 AI 메시지 설정
  useEffect(() => {
    setMessages([
      {
        id: Date.now(),
        text: '현재 노트 내용을 바탕으로 무엇이든 물어보세요!',
        sender: 'bot',
        followUp: [
          '이 노트의 핵심 내용을 세 문장으로 요약해줘.',
          '여기서 더 깊이 탐구할 만한 주제는 뭐가 있을까?',
          '이 개념을 실제 사례에 적용해서 설명해줘.'
        ]
      }
    ])
  }, []);

  const handleNewChat = () => setMessages([]);
  const handleCopy = (text: string) => navigator.clipboard.writeText(text);

  const handleSaveToNote = async () => {
    if (messages.length === 0) return;
    const title = prompt("노트의 제목을 입력하세요:", "AI 채팅 기록");
    if (title) {
      try {
        const newNote = await addNoteFromChat(messages, title);
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

    const history: GeminiHistory[] = currentMessages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // ✨ [개선] API 요청 시 noteContext 포함
        body: JSON.stringify({ history, model: selectedModel, noteContext }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'API 요청 실패');
      }

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
        text: `죄송합니다, 답변을 생성하는 중 오류가 발생했습니다.\n\n오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        sender: 'bot',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const currentModelName = models.find(m => m.id === selectedModel)?.name || '모델 선택';

  return (
    <div className="flex flex-col h-full bg-card border-r rounded-r-lg shadow-lg">
      <div className="p-2 sm:p-4 border-b flex justify-between items-center">
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={isPopoverOpen} className="w-[180px] sm:w-[250px] justify-between">
              <span className="truncate">{currentModelName}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] sm:w-[280px] p-0">
            {models.map((model) => (
              <Button
                key={model.id} variant="ghost" className="w-full justify-start h-auto py-2"
                onClick={() => { setSelectedModel(model.id); setIsPopoverOpen(false); }}
              >
                <Check className={`mr-2 h-4 w-4 ${selectedModel === model.id ? 'opacity-100' : 'opacity-0'}`} />
                <span className="whitespace-normal text-left">{model.name}</span>
              </Button>
            ))}
          </PopoverContent>
        </Popover>

        {/* ✨ [개선] 닫기 버튼 추가 */}
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
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
                  <div className={`relative px-4 py-2 rounded-lg max-w-sm prose dark:prose-invert prose-p:my-0 prose-headings:my-2 ${msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
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
            placeholder={isLoading ? "답변을 생성 중입니다..." : "메시지를 입력하세요..."}
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
};