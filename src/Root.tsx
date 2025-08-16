import React from 'react';
import App from './App';
import VersionBadge from './components/VersionBadge';
import ClipboardCaptureAgent from './components/ClipboardCaptureAgent';

export default function Root(){
  return (
    <>
      <App key={props.key} />
      <VersionBadge />
      <ClipboardCaptureAgent />
    </>
  );
}
