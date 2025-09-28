import './index.css'
import React, { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import ErrorBoundary from './components/ErrorBoundary'
import Root from './App'
import { initInstallCapture } from './lib/install'
import * as pdfjsLib from 'pdfjs-dist';
import { ClerkProvider } from '@clerk/clerk-react';
import { koKR } from '@clerk/localizations';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

initInstallCapture()

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key");
}

const container = document.getElementById('root')!
ReactDOM.createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/" localization={koKR}>
        <Root />
      </ClerkProvider>
    </ErrorBoundary>
  </StrictMode>
)
