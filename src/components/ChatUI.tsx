import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { ArrowUp, Loader2, RefreshCw, Copy, Save, ChevronsUpDown, Check, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Add Tooltip imports
import MarkdownRenderer from './MarkdownRenderer';
import { useNotes } from '../lib/useNotes';
import { useCallback } from 'react'; // useCallback 임포트 추가

const models = [
    { id: 'openai/gpt-oss-20b:free', name: '🧠 모두가 아는 그 gpt' },
    { id: 'x-ai/grok-4-fast:free', name: '🚀화성 갈끄니까 Grok' },
    { id: 'deepseek/deepseek-chat-v3.1:free', name: '✨ deepseek..성능은 좋음' },
    { id: 'meta-llama/llama-4-maverick:free', name: '라마 🦙귀여운 Llama Ai' },
];

export interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  followUp?: string[];
}
interface GeminiHistory {
  role: 'user' | 'model';
  parts: { text: string }[];
}

// 초기 메시지를 생성하는 헬퍼 함수
const createInitialMessage = (): Message => ({
  id: Date.now(),
  text: '현재 노트 내용을 바탕으로 무엇이든 물어보세요!',
  sender: 'bot',
  followUp: [
    '이 노트의 핵심 내용을 세 문장으로 요약해줘.',
    '여기서 더 깊이 탐구할 만한 주제는 뭐가 있을까?',
    '이 개념을 실제 사례에 적용해서 설명해줘.'
  ]
});

interface ChatUIProps {
  noteContext: string;
  onClose: () => void;
  noteId: string;
}

export const ChatUI: React.FC<ChatUIProps> = ({ noteContext, onClose, noteId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { updateNote, getNote } = useNotes();
  const prevMessagesLength = useRef(messages.length);
  
  const [selectedModel, setSelectedModel] = useState(models[0].id);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [useGeminiDirect, setUseGeminiDirect] = useState(false); // New state for direct Gemini

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    // 노트에 저장된 이전 대화 기록을 불러옵니다.
    const loadChatHistory = async () => {
        if (noteId) {
            const note = await getNote(noteId);
            const history = note?.chatHistory;
            if (history && history.length > 0) {
                setMessages(history);
            } else {
                setMessages([createInitialMessage()]);
            }
        }
    };
    loadChatHistory();
  }, [noteId, getNote]);

  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      scrollToBottom();
    }
    prevMessagesLength.current = messages.length;
  }, [messages]);

  const handleNewChat = () => {
    setMessages([createInitialMessage()]);
  };

  const handleCopy = (text: string) => navigator.clipboard.writeText(text);

  const handleSaveChat = useCallback(async () => {
    if (!noteId || messages.length <= 1) return;

    try {
      await updateNote(noteId, { chatHistory: messages });
      alert('대화 내용이 노트에 성공적으로 저장되었습니다!');
    } catch (error) {
      console.error('Failed to save chat to note:', error);
      alert('대화 내용을 노트에 저장하는 데 실패했습니다.');
    }
  }, [noteId, messages, updateNote]);

  const sendNewMessage = (text: string) => {
      handleSendMessage(text);
  }

  const handleSendMessage = async (text: string | React.FormEvent) => {
    if (typeof text === 'object') {
        text.preventDefault();
    }
    const currentInput = (typeof text === 'string' ? text : inputValue).trim();
    if (currentInput === '' || isLoading) return;

    const userMessage: Message = { id: Date.now(), text: currentInput, sender: 'user' };
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setInputValue('');
    setIsLoading(true);

    const history: GeminiHistory[] = currentMessages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    const botMessage: Message = {
      id: Date.now() + 1,
      text: '',
      sender: 'bot',
      followUp: [],
    };
    setMessages(prev => [...prev, botMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history, model: selectedModel, noteContext, useGeminiDirect }), // Include useGeminiDirect flag
      });

      if (!response.ok || !response.body) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'API 요청 실패');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponseText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6);
                if (jsonStr === '[DONE]') continue;
                try {
                    const data = JSON.parse(jsonStr);
                    if (data.token) {
                        fullResponseText += data.token;
                        setMessages(prev => prev.map(msg => 
                            msg.id === botMessage.id 
                                ? { ...msg, text: fullResponseText } 
                                : msg
                        ));
                    } else if (data.followUp) {
                        setMessages(prev => prev.map(msg => 
                            msg.id === botMessage.id 
                                ? { ...msg, followUp: data.followUp } 
                                : msg
                        ));
                    }
                } catch (e) {
                    console.error('스트림 데이터 파싱 오류:', e);
                }
            }
        }
      }

    } catch (error) {
      console.error('API 통신 오류:', error);
      const errorMessageText = `죄송합니다, 답변을 생성하는 중 오류가 발생했습니다.\n\n오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
      setMessages((prev) => prev.map(msg => msg.id === botMessage.id ? {...msg, text: errorMessageText} : msg));
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
                        onClick={() => { setSelectedModel(model.id); setIsPopoverOpen(false); setUseGeminiDirect(false); }} // Reset useGeminiDirect
                      >
                        <Check className={`mr-2 h-4 w-4 ${selectedModel === model.id ? 'opacity-100' : 'opacity-0'}`} />
                        <span className="whitespace-normal text-left">{model.name}</span>
                      </Button>
                    ))}
                  </PopoverContent>
                </Popover>
      
                {/* Gemini Direct Button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={useGeminiDirect ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setUseGeminiDirect(true);
                          setSelectedModel('gemini-2.5-flash'); // Set default Gemini model
                          setIsPopoverOpen(false);
                          sendNewMessage(inputValue); // Trigger send with current input
                        }}
                        className="ml-2"
                      >
                        Gemini Direct
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>OpenRouter를 거치지 않고 Gemini API를 직접 사용합니다.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
      
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={handleSaveChat} title="현재 노트에 대화 저장">
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleNewChat} title="새 대화">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={onClose} title="닫기">
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>      <div ref={messagesEndRef} className="flex-1 p-4 overflow-y-auto">
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
                  <div className={`relative px-4 py-2 rounded-lg max-w-xl prose dark:prose-invert prose-p:my-0 prose-headings:my-2 ${msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <MarkdownRenderer content={msg.text} />
                    {msg.sender === 'bot' && !isLoading && msg.text && (
                      <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleCopy(msg.text)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {msg.sender === 'bot' && !isLoading && msg.followUp && msg.followUp.length > 0 && (
                  <div className="mt-4 ml-11 flex flex-wrap gap-2">
                    {msg.followUp.map((q, i) => (
                      <Button key={i} variant="outline" size="sm" className="h-auto py-1.5" onClick={() => handleSendMessage(q)}>
                        {q}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
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
            className="w-full px-4 py-2 border rounded-full focus:ring-2 focus:ring-primary focus:border-transparent transition-all bg-background text-foreground placeholder:text-muted-foreground"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" className="rounded-full" disabled={isLoading || !inputValue.trim()}>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
          </Button>
        </form>
      </div>
    </div>
  );
};