import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { ArrowUp, Loader2, RefreshCw, Copy, Save, ChevronsUpDown, Check, X, Lightbulb } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import MarkdownRenderer from './MarkdownRenderer';
import { useNotes } from '../lib/useNotes';

// ... (models, Message, GeminiHistory, createInitialMessage interfaces remain the same)

interface ChatUIProps {
  noteContext: string;
  onClose: () => void;
  noteId: string;
  onSuggestionAccepted: (suggestion: { old: string; new: string }) => void;
}

export const ChatUI: React.FC<ChatUIProps> = ({ noteContext, onClose, noteId, onSuggestionAccepted }) => {
  // ... (hooks and other functions up to handleSendMessage remain the same)

  // Find the first active suggestion
  const activeSuggestion = messages.find(msg => msg.suggestion);

  return (
    <div className="flex flex-col h-full bg-card border-r rounded-r-lg shadow-lg">
      {/* Header remains the same */}
      <div ref={messagesEndRef} className="flex-1 p-4 overflow-y-auto">
        {/* Message mapping remains the same, but the button logic inside is removed */}
        {messages.map((msg) => (
          <div key={msg.id}>
            <div className={`flex items-start gap-3 group ${msg.sender === 'user' ? 'justify-end' : ''}`}>
              {/* ... */}
              <div className={`relative px-4 py-2 rounded-lg max-w-xl prose dark:prose-invert ...`}>
                <MarkdownRenderer content={msg.text} />
                {msg.sender === 'bot' && !isLoading && msg.text && (
                  <div className="absolute -top-2 -right-2 flex items-center gap-1">
                    {/* The suggestion buttons are now moved to the bottom bar */}
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleCopy(msg.text)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {/* ... isLoading spinner ... */}
      </div>

      {/* --- NEW SUGGESTION BAR --- */}
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

      {/* Input form */}
      <div className="p-4 border-t">
        <form id="chat-form" onSubmit={handleSendMessage} className="flex items-center gap-2">
          {/* ... input and submit button ... */}
        </form>
      </div>
    </div>
  );
};