import React from 'react';
import { ChatUI } from '../components/ChatUI';

export default function ChatPage() {
  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* 
        The main AppLayout provides padding. For a truly open, full-screen UI,
        we might need to create a separate layout or override styles.
        For now, this will place the ChatUI within the standard page layout.
      */}
      <ChatUI />
    </div>
  );
}
