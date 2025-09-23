import { useState, useCallback } from 'react';

interface UseLoadingResult {
  isLoading: boolean;
  loadingMessage: string | null;
  startLoading: (message?: string) => void;
  stopLoading: () => void;
  setMessage: (message: string | null) => void;
}

export function useLoading(): UseLoadingResult {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);

  const startLoading = useCallback((message: string = "로딩 중...") => {
    setIsLoading(true);
    setLoadingMessage(message);
  }, []);

  const stopLoading = useCallback(() => {
    setIsLoading(false);
    setLoadingMessage(null);
  }, []);

  const setMessage = useCallback((message: string | null) => {
    setLoadingMessage(message);
  }, []);

  return {
    isLoading,
    loadingMessage,
    startLoading,
    stopLoading,
    setMessage,
  };
}
