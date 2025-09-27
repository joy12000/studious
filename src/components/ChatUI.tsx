import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { ArrowUp, Loader2, RefreshCw, Copy, Save, ChevronsUpDown, Check, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import MarkdownRenderer from './MarkdownRenderer';
import { useNotes } from '../lib/useNotes';

const models = [
    { id: 'gemini-2.5-pro', name: '✨ Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', name: '⚡ Gemini 2.5 Flash' },
    { id: 'openai/gpt-oss-20b:free', name: '🧠 챗 GPT' },
    { id: 'x-ai/grok-4-fast:free', name: '🚀 Grok' },
    { id: 'meta-llama/llama-4-maverick:free', name: '🦙 AI Llama' },
    { id: 'gemini-2.5-flash-lite', name: '💡 Gemini 2.5 Flash Lite' },
    { id: 'gemini-2.0-flash', name: '🌟 Gemini 2.0 Flash' },
    { id: 'deepseek/deepseek-chat-v3.1:free', name: '🔍 Deepseek v3.1' },
];

export interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  suggestion?: {
    old: string;
    new: string;
  };
}
interface GeminiHistory {
  role: 'user' | 'model';
  parts: { text: string }[];
}

const createInitialMessage = (): Message => ({
  id: Date.now(),
  text: '현재 노트 내용을 바탕으로 무엇이든 물어보세요!',
  sender: 'bot',
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
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

  const handleApplyChange = async (suggestion: { old: string; new: string }) => {
    console.log('🔧 Applying suggestion:', suggestion);
    const note = await getNote(noteId);
    if (note) {
      const newContent = note.content.replace(suggestion.old, suggestion.new);
      await updateNote(noteId, { content: newContent });
      alert('변경 사항이 적용되었습니다.');
    }
  };

  // 여러 패턴으로 suggestion 감지하는 함수
  const detectSuggestion = (text: string) => {
    console.log('🔍 Detecting suggestions in text (length: ' + text.length + ')');
    
    // 다양한 정규식 패턴들
    const patterns = [
      // 패턴 1: 기존 엄격한 패턴
      /```suggestion\s*\r?\n기존 내용\s*\r?\n([\s\S]*?)\s*\r?\n===>\s*\r?\n새로운 내용\s*\r?\n([\s\S]*?)\s*```/,
      
      // 패턴 2: 더 유연한 공백 처리
      /```suggestion\s*[\r\n]+기존\s*내용\s*[\r\n]+([\s\S]*?)[\r\n]+==+>\s*[\r\n]+새로운\s*내용\s*[\r\n]+([\s\S]*?)[\r\n]*```/,
      
      // 패턴 3: 매우 관대한 패턴
      /```suggestion[\s\S]*?기존[\s\S]*?내용[\s\S]*?([\s\S]*?)[\s\S]*?==+>[\s\S]*?새로운[\s\S]*?내용[\s\S]*?([\s\S]*?)[\s\S]*?```/,
    ];
    
    for (let i = 0; i < patterns.length; i++) {
      const match = text.match(patterns[i]);
      console.log(`🎯 Pattern ${i + 1} result:`, match ? 'MATCH ✅' : 'NO MATCH ❌');
      
      if (match && match.length >= 3) {
        console.log('📋 Old content:', JSON.stringify(match[1].trim().substring(0, 100)));
        console.log('📋 New content:', JSON.stringify(match[2].trim().substring(0, 100)));
        return {
          old: match[1].trim(),
          new: match[2].trim()
        };
      }
    }
    
    // 마지막 시도: 단순 문자열 파싱
    if (text.includes('```suggestion') && text.includes('===>')) {
      console.log('🔧 Trying manual parsing...');
      
      const suggestionStart = text.indexOf('```suggestion');
      const suggestionEnd = text.indexOf('```', suggestionStart + 13);
      
      if (suggestionStart !== -1 && suggestionEnd !== -1) {
        const suggestionBlock = text.substring(suggestionStart + 13, suggestionEnd);
        console.log('📋 Suggestion block:', suggestionBlock.substring(0, 200));
        
        const arrowIndex = suggestionBlock.indexOf('===>');
        if (arrowIndex !== -1) {
          const oldPart = suggestionBlock.substring(0, arrowIndex);
          const newPart = suggestionBlock.substring(arrowIndex + 4);
          
          // "기존 내용"과 "새로운 내용" 제거
          const cleanOld = oldPart.replace(/기존\s*내용/g, '').trim();
          const cleanNew = newPart.replace(/새로운\s*내용/g, '').trim();
          
          if (cleanOld && cleanNew) {
            console.log('✅ Manual parsing success!');
            return {
              old: cleanOld,
              new: cleanNew
            };
          }
        }
      }
    }
    
    console.log('❌ No suggestion detected');
    return null;
  };

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
    };
    setMessages(prev => [...prev, botMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history, model: selectedModel, noteContext }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'API 요청 실패');
      }

      if (!response.body) {
        throw new Error('API 응답 본문이 없습니다.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6);
                if (jsonStr.trim() === '[DONE]') continue;
                try {
                    const data = JSON.parse(jsonStr);
                    if (data.token) {
                      setMessages(prev => prev.map(msg => {
                        if (msg.id === botMessage.id) {
                          const newText = msg.text + data.token;
                          return { ...msg, text: newText };
                        }
                        return msg;
                      }));
                    }
                } catch (e) {
                    console.error('스트림 데이터 파싱 오류:', e, '원본:', jsonStr);
                }
            }
        }
      }

      // 스트리밍 완료 후 최종 suggestion 체크
      console.log('🏁 Stream completed, checking for suggestions...');
      
      setMessages(prev => prev.map(msg => {
        if (msg.id === botMessage.id && msg.text && !msg.suggestion) {
          console.log('🔍 Checking message for suggestions:', msg.id);
          
          const suggestion = detectSuggestion(msg.text);
          
          if (suggestion) {
            console.log('✅ Suggestion detected and applied!');
            console.log('🔧 Suggestion object:', suggestion);
            
            const updatedMsg = {
              ...msg,
              suggestion: suggestion,
            };
            
            console.log('🔧 Updated message object:', updatedMsg);
            return updatedMsg;
          }
        }
        return msg;
      }));

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
    <div className="flex flex-col h-full bg-card border-r rounded-r-lg shadow-lg pb-6">
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
              </div>
      <div ref={messagesEndRef} className="flex-1 p-4 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">AI에게 무엇이든 물어보세요!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              console.log('🎨 Rendering message:', msg.id, 'has suggestion:', !!msg.suggestion);
              return (
                <div key={msg.id}>
                  <div className={`flex items-start gap-3 group ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                    {msg.sender === 'bot' && (
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">AI</div>
                    )}
                    <div className={`relative px-4 py-2 rounded-lg max-w-xl prose dark:prose-invert prose-p:my-0 prose-headings:my-2 ${msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <MarkdownRenderer content={msg.text} />
                      {msg.sender === 'bot' && !isLoading && msg.text && (
                        <div className="absolute -top-2 -right-2 flex items-center gap-1">
                          {msg.suggestion && (
                            <>
                              <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded opacity-100">
                                수락
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 bg-green-100 hover:bg-green-200 opacity-100 transition-opacity" 
                                onClick={() => handleApplyChange(msg.suggestion!)}
                                title="노트에 수정 사항 적용"
                              >
                                <Check className="h-4 w-4 text-green-700" />
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleCopy(msg.text)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {isLoading && (
                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">AI</div>
                    <div className="px-4 py-2 rounded-lg bg-muted"><Loader2 className="h-5 w-5 animate-spin" /></div>
                </div>
            )}
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