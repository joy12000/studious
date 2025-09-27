import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { ArrowUp, Loader2, RefreshCw, Copy, Save, ChevronsUpDown, Check, X, Lightbulb, Plus, FileText } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import MarkdownRenderer from './MarkdownRenderer';
import { useNotes } from '../lib/useNotes';
import { upload } from '@vercel/blob/client';
import { convertPdfToImages } from '../lib/pdfUtils';

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
  fileUrls?: string[]; // Added for file attachments
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
  onSuggestionAccepted: (suggestion: { old: string; new: string }) => void;
}

export const ChatUI: React.FC<ChatUIProps> = ({ noteContext, onClose, noteId, onSuggestionAccepted }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { updateNote, getNote } = useNotes();
  const prevMessagesLength = useRef(messages.length);

  const [selectedModel, setSelectedModel] = useState(models[0].id);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]); // New state for selected files
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for hidden file input

  const MAX_FILE_SIZE_MB = 5; // Max size per file
  const MAX_TOTAL_SIZE_MB = 10; // Max total size for all files

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

  const handleApplyChange = (messageId: number, suggestion: { old: string; new: string }) => {
    onSuggestionAccepted(suggestion);
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, suggestion: undefined } : msg
    ));
    alert('변경 사항이 적용되었습니다.');
  };

  const handleReject = (messageId: number) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, suggestion: undefined } : msg
    ));
  };

  const detectSuggestion = (text: string) => {
    const patterns = [
      /```suggestion\s*\r?\n기존 내용\s*\r?\n([\s\S]*?)\s*\r?\n===>\s*\r?\n새로운 내용\s*\r?\n([\s\S]*?)\s*```/,
      /```suggestion\s*[\r\n]+기존\s*내용\s*[\r\n]+([\s\S]*?)[\r\n]+==+>\s*[\r\n]+새로운\s*내용\s*[\r\n]+([\s\S]*?)[\r\n]*```/,
      /```suggestion[\s\S]*?기존[\s\S]*?내용[\s\S]*?([\s\S]*?)[\s\S]*?==+>[\s\S]*?새로운[\s\S]*?내용[\s\S]*?([\s\S]*?)[\s\S]*?```/,
    ];
    for (let i = 0; i < patterns.length; i++) {
      const match = text.match(patterns[i]);
      if (match && match.length >= 3) {
        return {
          old: match[1].trim(),
          new: match[2].trim()
        };
      }
    }
    if (text.includes('```suggestion') && text.includes('===>')) {
      const suggestionStart = text.indexOf('```suggestion');
      const suggestionEnd = text.indexOf('```', suggestionStart + 13);
      if (suggestionStart !== -1 && suggestionEnd !== -1) {
        const suggestionBlock = text.substring(suggestionStart + 13, suggestionEnd);
        const arrowIndex = suggestionBlock.indexOf('===>');
        if (arrowIndex !== -1) {
          const oldPart = suggestionBlock.substring(0, arrowIndex);
          const newPart = suggestionBlock.substring(arrowIndex + 4);
          const cleanOld = oldPart.replace(/기존\s*내용/g, '').trim();
          const cleanNew = newPart.replace(/새로운\s*내용/g, '').trim();
          if (cleanOld && cleanNew) {
            return {
              old: cleanOld,
              new: cleanNew
            };
          }
        }
      }
    }
    return null;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;

    const newFiles = Array.from(event.target.files);
    let filesToAdd: File[] = [];
    let currentTotalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);

    for (const file of newFiles) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        alert(`개별 파일 크기는 ${MAX_FILE_SIZE_MB}MB를 초과할 수 없습니다: ${file.name}`);
        continue;
      }
      // PDF to image conversion logic (similar to ChatPage/ReviewPage)
      if (file.type === 'application/pdf') {
        const isScanned = window.confirm("이 PDF가 스캔된 문서인가요? (텍스트 선택이 불가능한 경우) '확인'을 누르면 이미지로 변환하고, '취소'를 누르면 텍스트로 처리합니다.");
        if (isScanned) {
            setIsLoading(true);
            try {
              // Assuming convertPdfToImages returns an array of File objects (images)
              const images = await convertPdfToImages(file, (progress) => {
                // No direct loading message for ChatUI, but can be added if needed
              });
              filesToAdd.push(...images);
            } catch (error) {
              console.error("PDF 변환 실패:", error);
              alert('PDF 파일을 이미지로 변환하는 데 실패했습니다.');
            } finally {
              setIsLoading(false);
            }
        } else {
            filesToAdd.push(file);
        }
      } else {
        filesToAdd.push(file);
      }
    }

    const totalSizeAfterAdding = currentTotalSize + filesToAdd.reduce((sum, file) => sum + file.size, 0);
    if (totalSizeAfterAdding > MAX_TOTAL_SIZE_MB * 1024 * 1024) {
      alert(`총 파일 크기는 ${MAX_TOTAL_SIZE_MB}MB를 초과할 수 없습니다.`);
      return;
    }

    setSelectedFiles(prev => [...prev, ...filesToAdd]);
    if(fileInputRef.current) {
        fileInputRef.current.value = ''; // Clear input
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (text: string | React.FormEvent) => {
    if (typeof text === 'object') {
        text.preventDefault();
    }
    const currentInput = (typeof text === 'string' ? text : inputValue).trim();
    if (currentInput === '' && selectedFiles.length === 0 || isLoading) return; // Allow sending only files

    const userMessage: Message = { id: Date.now(), text: currentInput, sender: 'user' };
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setInputValue('');
    setIsLoading(true);

    let uploadedBlobUrls: string[] = [];
    if (selectedFiles.length > 0) {
      try {
        const blobResults = await Promise.all(
          selectedFiles.map(file => 
            upload(file.name, file, {
              access: 'public',
              handleUploadUrl: '/api/upload/route',
            })
          )
        );
        uploadedBlobUrls = blobResults.map(b => b.url);
      } catch (error) {
        console.error("File upload failed:", error);
        alert("파일 업로드 중 오류가 발생했습니다.");
        setIsLoading(false);
        return;
      }
    }

    const history: GeminiHistory[] = currentMessages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    const botMessage: Message = {
      id: Date.now() + 1,
      text: '',
      sender: 'bot',
      fileUrls: uploadedBlobUrls, // Attach file URLs to the bot's message for context
    };
    setMessages(prev => [...prev, botMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history, model: selectedModel, noteContext, fileUrls: uploadedBlobUrls }),
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

      setMessages(prev => prev.map(msg => {
        if (msg.id === botMessage.id && msg.text && !msg.suggestion) {
          const suggestion = detectSuggestion(msg.text);
          if (suggestion) {
            return {
              ...msg,
              suggestion: suggestion,
            };
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
      setSelectedFiles([]); // Clear selected files after sending
    }
  };

  const currentModelName = models.find(m => m.id === selectedModel)?.name || '모델 선택';
  
  const activeSuggestion = messages.find(msg => msg.suggestion);

  return (
    <div className="flex flex-col h-full bg-card border-r rounded-r-lg shadow-lg pb-4">
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
              return (
                <div key={msg.id}>
                  <div className={`flex items-start gap-3 group ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                    {msg.sender === 'bot' && (
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">AI</div>
                    )}
                    <div className={`relative px-4 py-2 rounded-lg max-w-xl prose dark:prose-invert prose-p:my-0 prose-headings:my-2 ${msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <MarkdownRenderer content={msg.text} />
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
      
      {activeSuggestion && (
        <div className="p-3 border-t bg-blue-50/50 dark:bg-blue-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">AI의 수정 제안이 있습니다.</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleReject(activeSuggestion.id)}>
                <X className="h-4 w-4 mr-1" />
                거절
              </Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleApplyChange(activeSuggestion.id, activeSuggestion.suggestion!)}>
                <Check className="h-4 w-4 mr-1" />
                수락 및 적용
              </Button>
            </div>
          </div>
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="p-2 border-t bg-muted/50">
          <h3 className="text-xs font-semibold mb-1">첨부 파일:</h3>
          <ul className="flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              <li key={index} className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full text-xs">
                <FileText className="h-3 w-3" />
                {file.name}
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeFile(index)}>
                  <X className="h-3 w-3" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="p-4 border-t flex items-center gap-2">
        <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileChange} />
        <Button variant="outline" size="icon" className="rounded-full flex-shrink-0" onClick={() => fileInputRef.current?.click()}>
          <Plus className="h-5 w-5" />
        </Button>
        <form id="chat-form" onSubmit={handleSendMessage} className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isLoading ? "답변을 생성 중입니다..." : "메시지를 입력하세요..."}
            className="w-full px-4 py-2 border rounded-full focus:ring-2 focus:ring-primary focus:border-transparent transition-all bg-background text-foreground placeholder:text-muted-foreground"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" className="rounded-full" disabled={isLoading || (!inputValue.trim() && selectedFiles.length === 0)}>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
          </Button>
        </form>
      </div>
    </div>
  );
};