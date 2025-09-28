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
import DashboardPage from './pages/DashboardPage'; // 📈 대시보드 페이지 임포트
import ReviewDeckPage from './pages/ReviewDeckPage'; // 🧠 복습 덱 페이지 임포트
import ShareHandler from './components/ShareHandler';
import AppLayout from './components/AppLayout';
import { useNotes } from './lib/useNotes';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/clerk-react";

function App() {
  const navigate = useNavigate();
  const { importNote } = useNotes();
  // ... (useEffect 로직은 동일) ...

  return (
    <AppLayout>
      <header style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem' }}>
        <SignedOut>
          <SignInButton />
          <SignUpButton />
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </header>
      <ShareHandler />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/notes" element={<NoteListPage />} />
        <Route path="/note/:id" element={<NotePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/assignment" element={<AssignmentHelperPage />} />
        <Route path="/dashboard" element={<DashboardPage />} /> {/* 📈 대시보드 라우트 추가 */}
        <Route path="/review-deck" element={<ReviewDeckPage />} /> {/* 🧠 복습 덱 라우트 추가 */}
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