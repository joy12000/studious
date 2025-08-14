import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CapturePage from './pages/CapturePage';
import NotePage from './pages/NotePage';
import SettingsPage from './pages/SettingsPage';
import ShareHandler from './components/ShareHandler';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <header className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="font-semibold">SelfDev Notes</Link>
          <nav className="flex gap-4 text-sm">
            <Link to="/">Home</Link>
            <Link to="/capture">Capture</Link>
            <Link to="/settings">Settings</Link>
          </nav>
        </header>
        <ShareHandler />
        <main className="max-w-3xl mx-auto px-4 pb-20">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/capture" element={<CapturePage />} />
            <Route path="/note/:id" element={<NotePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
