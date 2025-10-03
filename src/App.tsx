import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import NoteListPage from './pages/NoteListPage';
import NotePage from './pages/NotePage';
import SettingsPage from './pages/SettingsPage';
import SharedNotePage from './pages/SharedNotePage';
import SchedulePage from './pages/SchedulePage';
import ReviewPage from './pages/ReviewPage';
import TextbookPage from './pages/TextbookPage';
import ChatPage from './pages/ChatPage';
import AssignmentHelperPage from './pages/AssignmentHelperPage';
import DashboardPage from './pages/DashboardPage'; // 📈 대시보드 페이지 임포트
import ReviewDeckPage from './pages/ReviewDeckPage'; // 🧠 복습 덱 페이지 임포트
import MobileUploadPage from './pages/MobileUploadPage';
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

import { AnimatePresence, motion } from 'framer-motion';

function App() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route 
          element={
            <AppLayout 
              SignedIn={SignedIn} 
              SignedOut={SignedOut} 
              SignInButton={SignInButton} 
              SignUpButton={SignUpButton} 
              UserButton={UserButton} 
            />
          }
        >
          <Route path="/" element={<HomePage />} />
          <Route path="/notes" element={<NoteListPage />} />
          <Route path="/note/:id" element={<NotePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/assignment" element={<AssignmentHelperPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/review-deck" element={<ReviewDeckPage />} />
          <Route path="/share" element={<ShareHandler />} />
          <Route path="/shared-note" element={<SharedNotePage />} />
          <Route path="/textbook" element={<TextbookPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/m/upload" element={<MobileUploadPage />} />
        </Route>
      </Routes>
    </AnimatePresence>
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