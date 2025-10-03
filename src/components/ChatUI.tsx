import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { ArrowUp, Loader2, RefreshCw, Copy, Save, ChevronsUpDown, Check, X, Lightbulb, Plus, FileText, UploadCloud, StopCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import MarkdownRenderer from './MarkdownRenderer';
import { SuggestionBlock } from './SuggestionBlock';
import { useNotes } from '../lib/useNotes';
import { upload } from '@vercel/blob/client';
import { convertPdfToImages } from '../lib/pdfUtils';
import { Message, Note } from '../lib/types'; // Import Message and Note
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from '@clerk/clerk-react';
import { createClient } from '@supabase/supabase-js';

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

interface GeminiHistory {
  role: 'user' | 'model';
  parts: { text: string }[];
}

const createInitialMessage = (): Message => ({
  id: Date.now(),
  type: 'text',
  content: '현재 노트 내용을 바탕으로 무엇이든 물어보세요!',
  sender: 'bot',
});

interface ChatUIProps {
  noteContext?: string;
  onClose?: () => void;
  noteId?: string;
  onSuggestionAccepted?: (suggestion: { old: string; new: string }) => void;
}

export const ChatUI: React.FC<ChatUIProps> = ({ noteContext = '무엇이든 물어보세요!', onClose, noteId, onSuggestionAccepted }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { notes, updateNote, getNote } = useNotes(); // Get all notes
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const chatInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // State for note selection
  const [selectedNotes, setSelectedNotes] = useState<Note[]>([]);
  const [isNotePickerOpen, setIsNotePickerOpen] = useState(false);
  const [noteSearchQuery, setNoteSearchQuery] = useState('');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMobileUploadClick = () => {
    if (isMobile) navigate('/m/upload');
  };

  const [selectedModel, setSelectedModel] = useState(models[0].id);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isSyncedMediaOpen, setIsSyncedMediaOpen] = useState(false);
  const [syncedImages, setSyncedImages] = useState<{id: string, url: string}[]>([]);
  const [isSyncLoading, setIsSyncLoading] = useState(false);
  const { getToken } = useAuth();

  useEffect(() => {
    if (!isSyncedMediaOpen) return;

    const fetchInitialImages = async () => {
      setIsSyncLoading(true);
      try {
        const token = await getToken({ template: 'supabase' });
        if (!token) throw new Error("인증 토큰을 가져올 수 없습니다.");

        const authedSupabase = createClient(
          import.meta.env.VITE_PUBLICSUPABASE_URL!,
          import.meta.env.VITE_PUBLICSUPABASE_ANON_KEY!,
          { global: { headers: { Authorization: `Bearer ${token}` } } }
        );

        const { data, error } = await authedSupabase
          .from('synced_media')
          .select('id, url')
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;
        setSyncedImages(data || []);
      } catch (error) {
        console.error("Error fetching synced media:", error);
        toast.error("모바일 업로드 목록을 불러오는 데 실패했습니다.");
      } finally {
        setIsSyncLoading(false);
      }
    };

    fetchInitialImages();

    const channel = supabase.channel('synced_media_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'synced_media' }, (payload) => {
        setSyncedImages(prev => [payload.new as {id: string, url: string}, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSyncedMediaOpen, getToken]);

  const handleSyncedImageClick = async (imageUrl: string) => {
    try {
      toast.loading('이미지 첨부 중...');
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const fileName = imageUrl.split('/').pop() || 'mobile-upload.jpg';
      const file = new File([blob], fileName, { type: blob.type });
      
      setSelectedFiles(prev => [...prev, file]);
      setIsSyncedMediaOpen(false);
      toast.dismiss();
      toast.success('이미지가 첨부되었습니다.');
    } catch (error) {
      toast.dismiss();
      toast.error('이미지를 첨부하는 데 실패했습니다.');
      console.error("Failed to fetch and attach synced image:", error);
    }
  };

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) setSelectedFiles(prev => [...prev, file]);
        }
      }
    };
    const inputElement = chatInputRef.current;
    if (inputElement) inputElement.addEventListener('paste', handlePaste as EventListener);
    return () => {
      if (inputElement) inputElement.removeEventListener('paste', handlePaste as EventListener);
    };
  }, [setSelectedFiles]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadChatHistory = useCallback(async () => {
    if (noteId) {
      const note = await getNote(noteId);
      const history = note?.chatHistory;
      setMessages(history && history.length > 0 ? history : [createInitialMessage()]);
    }
  }, [noteId, getNote]);

  useEffect(() => {
    loadChatHistory();
    return () => {
      const currentMessages = messagesRef.current;
      if (noteId && currentMessages.length > 1) {
        updateNote(noteId, { chatHistory: currentMessages });
      }
    }
  }, [noteId, getNote, updateNote, loadChatHistory]);

  const handleNewChat = async () => {
    setMessages([createInitialMessage()]);
    if (noteId) {
      try {
        await updateNote(noteId, { chatHistory: [] });
      } catch (error) {
        console.error('Failed to clear chat history in note:', error);
      }
    }
  };

  const handleSaveChat = useCallback(async () => {
    if (!noteId || messages.length <= 1) return;
    try {
      await updateNote(noteId, { chatHistory: messages });
      toast.success('대화 내용이 노트에 저장되었습니다!');
    } catch (error) {
      console.error('Failed to save chat to note:', error);
      toast.error('대화 내용을 저장하는 데 실패했습니다.');
    }
  }, [noteId, messages, updateNote]);

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

  const MAX_FILE_SIZE_MB = 10;
  const MAX_TOTAL_SIZE_MB = 10;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;

    const newFiles = Array.from(event.target.files);
    let filesToAdd: File[] = [];
    let currentTotalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);

    for (const file of newFiles) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`개별 파일 크기는 ${MAX_FILE_SIZE_MB}MB를 초과할 수 없습니다: ${file.name}`);
        continue;
      }
      if (file.type === 'application/pdf') {
        const isScanned = window.confirm("이 PDF가 스캔된 문서인가요? (텍스트 추출이 불가능한 경우) '확인'을 누르면 이미지로 변환하고, '취소'를 누르면 텍스트로 처리합니다.");
        if (isScanned) {
            setIsLoading(true);
            try {
              const images = await convertPdfToImages(file, (progress) => {
                // No direct loading message for ChatUI, but can be added if needed
              });
              filesToAdd.push(...images);
            } catch (error) {
              console.error("PDF 변환 실패:", error);
              toast.error('PDF 파일을 이미지로 변환하는 데 실패했습니다.');
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
      toast.error(`총 파일 크기는 ${MAX_TOTAL_SIZE_MB}MB를 초과할 수 없습니다.`);
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

  const filteredNotes = (notes || []).filter(note => 
    !note.is_deleted && (
      note.title.toLowerCase().includes(noteSearchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(noteSearchQuery.toLowerCase())
    )
  );

  const handleToggleNoteSelection = (note: Note) => {
    setSelectedNotes(prev => 
      prev.some(n => n.id === note.id)
        ? prev.filter(n => n.id !== note.id)
        : [...prev, note]
    );
  };

  const handleRemoveSelectedNote = (noteId: string) => {
    setSelectedNotes(prev => prev.filter(n => n.id !== noteId));
  };

  const handleSendMessage = async (text: string | React.FormEvent) => {
    if (typeof text === 'object') text.preventDefault();
    const currentInput = (typeof text === 'string' ? text : inputValue).trim();
    if ((currentInput === '' && selectedFiles.length === 0 && selectedNotes.length === 0) || isLoading) return;

    const userMessage: Message = { id: Date.now(), type: 'text', content: currentInput, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let uploadedBlobUrls: string[] = [];
    if (selectedFiles.length > 0) {
      try {
        const blobResults = await Promise.all(
          selectedFiles.map(file => upload(file.name, file, { access: 'public', handleUploadUrl: '/api/upload/route' }))
        );
        uploadedBlobUrls = blobResults.map(b => b.url);
      } catch (error) {
        console.error("File upload failed:", error);
        toast.error("파일 업로드 중 오류가 발생했습니다.");
        setIsLoading(false);
        return;
      }
    }

    const additionalContext = selectedNotes.length > 0 
      ? selectedNotes.map(note => `--- 참고 노트: ${note.title} ---\n${note.content}`).join('\n\n')
      : '';
    
    const combinedNoteContext = [noteContext, additionalContext].filter(Boolean).join('\n\n');

    const history: GeminiHistory[] = [...messages, userMessage].map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    const botMessage: Message = { id: Date.now() + 1, type: 'text', content: '', sender: 'bot', fileUrls: uploadedBlobUrls };
    setMessages(prev => [...prev, botMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history, model: selectedModel, noteContext: combinedNoteContext, fileUrls: uploadedBlobUrls }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) throw new Error('API 응답 오류');

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
              if (data.type === 'token' && data.content) {
                setMessages(prev => prev.map(msg => 
                  msg.id === botMessage.id ? { ...msg, content: msg.content + data.content } : msg
                ));
              }
            } catch (e) {
              console.error('스트림 데이터 파싱 오류:', e, '원본:', jsonStr);
            }
          }
        }
      }
      setMessages(prev => prev.map(msg => {
        if (msg.id === botMessage.id && msg.content && !msg.suggestion) {
          const suggestion = detectSuggestion(msg.content);
          return suggestion ? { ...msg, suggestion } : msg;
        }
        return msg;
      }));
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('API 통신 오류:', error);
        const errorMsg = `죄송합니다, 답변 생성 중 오류가 발생했습니다: ${error.message}`;
        setMessages(prev => prev.map(msg => msg.id === botMessage.id ? { ...msg, content: errorMsg } : msg));
      }
    } finally {
      setIsLoading(false);
      setSelectedFiles([]);
      setSelectedNotes([]);
      abortControllerRef.current = null;
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
  };

  const currentModelName = models.find(m => m.id === selectedModel)?.name || '모델 선택';

  return (
    <div className={`flex flex-col bg-card pb-4 ${isMobile ? 'fixed inset-0 z-[9999]' : 'h-full border-r rounded-r-lg shadow-lg'}`}>
      <div className="p-2 sm:p-4 border-b flex justify-between items-center">
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-[180px] sm:w-[250px] justify-between">
              <span className="truncate">{currentModelName}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] sm:w-[280px] p-0">
            {models.map((model) => (
              <Button key={model.id} variant="ghost" className="w-full justify-start h-auto py-2" onClick={() => { setSelectedModel(model.id); setIsPopoverOpen(false); }}>
                <Check className={`mr-2 h-4 w-4 ${selectedModel === model.id ? 'opacity-100' : 'opacity-0'}`} />
                <span className="whitespace-normal text-left">{model.name}</span>
              </Button>
            ))}
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-1">
          {noteId && <Button variant="ghost" size="icon" onClick={handleSaveChat} title="현재 노트에 대화 저장"><Save className="h-4 w-4" /></Button>}
          <Button variant="ghost" size="icon" onClick={handleNewChat} title="새 대화"><RefreshCw className="h-4 w-4" /></Button>
          {onClose && <Button variant="ghost" size="icon" onClick={onClose} title="닫기"><X className="h-5 w-5" /></Button>}
        </div>
      </div>

      <div ref={messagesEndRef} className="flex-1 p-4 overflow-y-auto">
        {messages.length > 0 ? (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex items-start gap-3 group ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                {msg.sender === 'bot' && <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">AI</div>}
                <div className={`relative px-4 py-1 rounded-lg max-w-xl ${msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <div className="prose dark:prose-invert prose-p:my-0">
                    <MarkdownRenderer content={msg.content.replace(/```suggestion[\s\S]*?```/, '').trim()} />
                  </div>
                  {msg.suggestion && (
                    <SuggestionBlock
                      oldContent={msg.suggestion.old}
                      newContent={msg.suggestion.new}
                      onAccept={(newContent) => {
                        if (onSuggestionAccepted) {
                          onSuggestionAccepted({ old: msg.suggestion.old, new: newContent });
                        }
                      }}
                      onReject={() => {
                        // The block will hide itself.
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
            {isLoading && <div className="flex items-start gap-3"><div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">AI</div><div className="px-4 py-2 rounded-lg bg-muted"><Loader2 className="h-5 w-5 animate-spin" /></div></div>}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">AI에게 무엇이든 물어보세요!</p></div>
        )}
      </div>

      {(selectedFiles.length > 0 || selectedNotes.length > 0) && (
        <div className="p-2 border-t bg-muted/50 space-y-2">
          {selectedFiles.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold mb-1">첨부 파일:</h3>
              <ul className="flex flex-wrap gap-2">
                {selectedFiles.map((file, index) => (
                  <li key={index} className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full text-xs">
                    <FileText className="h-3 w-3" />{file.name}
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeFile(index)}><X className="h-3 w-3" /></Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {selectedNotes.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold mb-1">첨부 노트:</h3>
              <ul className="flex flex-wrap gap-2">
                {selectedNotes.map((note) => (
                  <li key={note.id} className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full text-xs">
                    <FileText className="h-3 w-3" />{note.title || '제목 없음'}
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleRemoveSelectedNote(note.id)}><X className="h-3 w-3" /></Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="p-4 border-t">
        {isLoading ? (
          <div className="flex items-center justify-center">
            <Button variant="outline" onClick={handleStopStreaming} className="w-full flex items-center gap-2"><StopCircle className="h-5 w-5" />생성 중단</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileChange} />
            <Button variant="outline" size="icon" className="rounded-full flex-shrink-0" onClick={() => fileInputRef.current?.click()} title="파일 첨부"><Plus className="h-5 w-5" /></Button>
            
            <Popover open={isNotePickerOpen} onOpenChange={setIsNotePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full flex-shrink-0" title="노트 첨부"><FileText className="h-5 w-5" /></Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] sm:w-[400px] p-0">
                <div className="p-2">
                  <input type="text" placeholder="노트 검색..." className="w-full p-2 border rounded-md mb-2 bg-transparent" value={noteSearchQuery} onChange={(e) => setNoteSearchQuery(e.target.value)} />
                  <div className="max-h-60 overflow-y-auto">
                    {filteredNotes.length > 0 ? filteredNotes.map(note => (
                      <div key={note.id} className="flex items-center justify-between p-2 hover:bg-muted rounded-md">
                        <label htmlFor={`note-chat-${note.id}`} className="flex items-center gap-2 cursor-pointer flex-1 truncate">
                          <input type="checkbox" id={`note-chat-${note.id}`} checked={selectedNotes.some(n => n.id === note.id)} onChange={() => handleToggleNoteSelection(note)} className="form-checkbox h-4 w-4 text-primary rounded focus:ring-primary" />
                          <span className="text-sm truncate">{note.title || '제목 없음'}</span>
                        </label>
                      </div>
                    )) : <p className="text-sm text-muted-foreground text-center p-4">일치하는 노트가 없습니다.</p>}
                  </div>
                </div>
                <div className="p-2 border-t bg-background"><Button onClick={() => setIsNotePickerOpen(false)} className="w-full">선택 완료</Button></div>
              </PopoverContent>
            </Popover>

            {isMobile ? (
              <Button variant="outline" size="icon" className="rounded-full flex-shrink-0" title="모바일에서 업로드" onClick={handleMobileUploadClick}><UploadCloud className="h-5 w-5" /></Button>
            ) : (
              <Popover open={isSyncedMediaOpen} onOpenChange={setIsSyncedMediaOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-full flex-shrink-0" title="모바일에서 가져오기"><UploadCloud className="h-5 w-5" /></Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="grid gap-4">
                    <div className="space-y-2"><h4 className="font-medium leading-none">모바일 업로드</h4><p className="text-sm text-muted-foreground">모바일 기기에서 업로드된 이미지 목록입니다.</p></div>
                    <div className="grid grid-cols-3 gap-2 h-48 overflow-y-auto border p-2 rounded-lg">
                      {isSyncLoading ? <p className="col-span-3 text-center text-sm text-muted-foreground">불러오는 중...</p> : syncedImages.length === 0 ? <p className="col-span-3 text-center text-sm text-muted-foreground">업로드된 이미지가 없습니다.</p> : syncedImages.map((image) => (
                        <button key={image.id} className="relative aspect-square rounded-md overflow-hidden hover:opacity-80 transition-opacity" onClick={() => handleSyncedImageClick(image.url)}>
                          <img src={image.url} alt="Synced image" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <form id="chat-form" onSubmit={handleSendMessage} className="flex-1 flex items-center gap-2">
              <input ref={chatInputRef} type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder={"메시지를 입력하세요..."} className="w-full px-4 py-2 border rounded-full focus:ring-2 focus:ring-primary focus:border-transparent transition-all bg-background text-foreground placeholder:text-muted-foreground" />
              <Button type="submit" size="icon" className="rounded-full" disabled={!inputValue.trim() && selectedFiles.length === 0 && selectedNotes.length === 0}><ArrowUp className="h-5 w-5" /></Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
