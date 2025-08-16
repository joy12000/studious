import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CapturePage from './pages/CapturePage';
import NotePage from './pages/NotePage';
import SettingsPage from './pages/SettingsPage';
import ShareHandler from './components/ShareHandler';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background text-foreground">
        <ShareHandler />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/capture" element={<CapturePage />} />
          <Route path="/note/:id" element={<NotePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/share" element={<ShareHandler />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
