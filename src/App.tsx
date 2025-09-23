import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import NoteListPage from './pages/NoteListPage';
import NotePage from './pages/NotePage';
import SettingsPage from './pages/SettingsPage';
import SharedNotePage from './pages/SharedNotePage';
import SchedulePage from './pages/SchedulePage';
import ReviewPage from './pages/ReviewPage';
import ChatPage from './pages/ChatPage';
import AssignmentHelperPage from './pages/AssignmentHelperPage';
import ShareHandler from './components/ShareHandler';
import AppLayout from './components/AppLayout';
import { useNotes } from './lib/useNotes';

function App() {
  const navigate = useNavigate();
  const { importNote } = useNotes();

  useEffect(() => {
    // --- 데이터 처리 중앙 핸들러 ---
    const useImport = (json: any) => {
      if (json && (json.content || json.title)) {
        console.log('Imported JSON', json);
        importNote(json).then(newNote => {
          navigate(`/note/${newNote.id}`);
        });
        alert('노트를 성공적으로 가져왔습니다.');
      } else {
        alert('가져온 파일에 노트 내용이 없습니다.');
      }
    };

    const handleIncomingPayload = (raw: any) => {
      if (!raw || typeof raw !== 'string') {
        alert('공유된 데이터가 비어있거나 형식이 잘못되었습니다.');
        return;
      }
      let data = null;
      // 1) JSON 시도
      try { data = JSON.parse(raw); }
      catch {
        // 2) data: URL/Base64 시도
        if (/^data:application\/json;base64,/.test(raw)) {
          try { data = JSON.parse(atob(raw.split(',')[1])); } catch {}
        }
        // 3) URL이면 fetch 후 JSON 시도 (CORS 주의)
        if (!data && /^https?:\/\//.test(raw)) {
          alert('URL을 가져오는 중... 이 작업은 몇 초 정도 걸릴 수 있습니다.');
          fetch(raw).then(r => r.text()).then(t => {
            try {
              const j = JSON.parse(t);
              useImport(j);
            } catch {
              alert('JSON이 아닌 링크/텍스트입니다.');
            }
          }).catch(err => {
            console.error('Fetch failed', err);
            alert('링크에서 데이터를 가져오는 데 실패했습니다.');
          });
          return;
        }
      }

      if (data) {
        // ExportedData 형식인지 확인 (version, notes 키 존재)
        if (data.version === 1 && Array.isArray(data.notes) && data.notes.length > 0) {
          useImport(data.notes[0]); // 첫 번째 노트만 가져옴
        } else {
          useImport(data);
        }
      } else {
        alert('유효한 JSON 데이터가 아닙니다.');
      }
    };

    // --- 이벤트 리스너 설정 ---

    // (A) 서비스 워커로부터 오는 메시지 수신 (Web Share Target)
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'shared-payload') {
        handleIncomingPayload(event.data.payloadText);
      }
    };
    navigator.serviceWorker?.addEventListener?.('message', handleServiceWorkerMessage);

    // (B) launchQueue로부터 오는 파일 처리 (File Handling)
    if ('launchQueue' in window) {
      // @ts-ignore
      window.launchQueue.setConsumer(async (launchParams) => {
        if (!launchParams?.files?.length) return;
        for (const handle of launchParams.files) {
          try {
            const file = await handle.getFile();
            const text = await file.text();
            handleIncomingPayload(text);
          } catch (e) {
            console.warn('launchQueue read failed', e);
          }
        }
      });
    }

    return () => {
      navigator.serviceWorker?.removeEventListener?.('message', handleServiceWorkerMessage);
    };

  }, [navigate, importNote]);

  return (
    <AppLayout>
      <ShareHandler />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/notes" element={<NoteListPage />} />
        <Route path="/note/:id" element={<NotePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/assignment" element={<AssignmentHelperPage />} />
        <Route path="/share" element={<ShareHandler />} />
        <Route path="/shared-note" element={<SharedNotePage />} />
        <Route path="/chat" element={<ChatPage />} />
      </Routes>
    </AppLayout>
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