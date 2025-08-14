import { StrictMode } from 'react';
import ErrorBoundary from './components/ErrorBoundary'
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initInstallCapture } from './lib/install';
import Root from './Root'

initInstallCapture();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>
)
