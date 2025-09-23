import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  message: string;
}

export default function LoadingOverlay({ message }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-lg bg-card p-8 text-card-foreground shadow-xl">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-medium">{message}</p>
        <p className="text-sm text-muted-foreground">잠시만 기다려주세요...</p>
      </div>
    </div>
  );
}
