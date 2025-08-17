import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CapturePage from './pages/CapturePage';
import NotePage from './pages/NotePage';
import SettingsPage from './pages/SettingsPage';
import SharedNotePage from './pages/SharedNotePage';
import ShareHandler from './components/ShareHandler';

// A component to handle navigation from outside the Router context
function ServiceWorkerMessageHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleServiceWorkerMessage = async (event: MessageEvent) => {
      if (event.data && event.data.type === 'shared-file') {
        alert('DEBUG: App.tsx received a file from the Service Worker.');
        const file = event.data.file as File;
        try {
          const content = await file.text();
          // Navigate to the shared note page with the content
          navigate('/shared-note', { state: { sharedContent: content } });
        } catch (error) {
          console.error('Error reading shared file:', error);
          alert('공유된 파일을 읽는 데 실패했습니다.');
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [navigate]);

  return null;
}

function App() {
  const navigate = useNavigate();

  useEffect(() => {
    if ('launchQueue' in window) {
      window.launchQueue.setConsumer(async (launchParams) => {
        if (!launchParams.files || launchParams.files.length === 0) {
          return;
        }
        
        const fileHandle = launchParams.files[0];
        const file = await fileHandle.getFile();
        
        try {
          const content = await file.text();
          navigate('/shared-note', { state: { sharedContent: content } });
        } catch (error) {
          console.error('Error reading launched file:', error);
          alert('파일을 여는 데 실패했습니다.');
        }
      });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ShareHandler />
      <ServiceWorkerMessageHandler />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/capture" element={<CapturePage />} />
        <Route path="/note/:id" element={<NotePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/share" element={<ShareHandler />} />
        <Route path="/shared-note" element={<SharedNotePage />} />
      </Routes>
    </div>
  );
}

function Root() {
  return (
    <Router>
      <App />
    </Router>
  );
}

export default Root;
