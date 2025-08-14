import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function ShareHandler() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if this is a share target request
    const text = searchParams.get('text');
    const url = searchParams.get('url');
    const title = searchParams.get('title');

    if (text || url || title) {
      // Redirect to capture page with shared data
      const captureParams = new URLSearchParams();
      if (text) captureParams.set('text', text);
      if (url) captureParams.set('url', url);
      if (title) captureParams.set('title', title);
      
      navigate(`/capture?${captureParams.toString()}`, { replace: true });
    }
  }, [searchParams, navigate]);

  return null;
}