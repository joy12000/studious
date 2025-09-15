import React from 'react';
import App from './App';

import ClipboardCaptureAgent from './components/ClipboardCaptureAgent';

export default function Root(){
  return (
    <>
      <App />
      
      <ClipboardCaptureAgent />
    </>
  );
}