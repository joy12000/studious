import React, { useEffect, useState } from 'react';
function getBuildVersion(): string {
  const w: any = window as any;
  const fromWindow = w.BUILD_VERSION;
  const fromEnv = (import.meta as any).env?.VITE_APP_VERSION || (import.meta as any).env?.VITE_COMMIT_SHA;
  const fallback = new Date().toISOString().slice(0,10);
  const v = (fromWindow || fromEnv || '').toString().trim();
  if (!v) return fallback;
  return v.length > 16 ? v.slice(0,16) : v;
}
export default function VersionBadge() {
  const [v,setV] = useState('');
  useEffect(()=>{ setV(getBuildVersion()); }, []);
  return (
    <div className="fixed bottom-2 right-3 z-[9999]">
      <span className="select-none text-[10px] px-2 py-1 rounded-full bg-black/70 text-white tracking-wider">
        v{v || 'local'}
      </span>
    </div>
  );
}
