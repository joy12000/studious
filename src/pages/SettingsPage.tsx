import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { initInstallCapture, canInstall, promptInstall, onCanInstallChange } from '../lib/install';
export default function SettingsPage(){
  const [installable,setInstallable]=useState(canInstall());
  useEffect(()=>{ initInstallCapture(); const off=onCanInstallChange(setInstallable); return ()=>off(); },[]);
  return (<div className="max-w-2xl mx-auto p-4 space-y-4">
    <h1 className="text-xl font-bold">설정</h1>
    <section className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
      <div><div className="font-semibold">앱 설치</div><div className="text-sm text-gray-500">홈 화면(앱)으로 설치해서 더 편하게 사용하세요.</div></div>
      <button onClick={async()=>{ const ok=await promptInstall(); if(!ok) alert('설치 가능 상태가 아니거나 취소됨'); }}
        className={"flex items-center gap-2 px-3 py-2 rounded-lg border "+(installable?"bg-blue-600 text-white border-blue-600":"bg-gray-100 text-gray-400 border-gray-200")}>
        <Download className="w-4 h-4"/>설치하기</button>
    </section>
  </div>);
}