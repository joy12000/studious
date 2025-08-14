import React from 'react';

export default function TopicBadge({ label, active, onClick }:{ label:string; active?:boolean; onClick?:()=>void }){
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded-full text-xs border ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'}`}
    >
      #{label}
    </button>
  );
}
