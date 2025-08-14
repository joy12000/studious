import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
export default function FilterBar({ filters, onFiltersChange, availableTopics }: any) {
  const [localSearch, setLocalSearch] = useState(filters.search || '');
  const [isComposing, setIsComposing] = useState(false);
  const first = useRef(true);
  useEffect(()=>{ setLocalSearch(filters.search || ''); }, [filters.search]);
  useEffect(()=>{ if(first.current){ first.current=false; return; } if(isComposing) return;
    const t=setTimeout(()=>{ if(localSearch !== (filters.search||'')) onFiltersChange({ ...filters, search: localSearch }); }, 280);
    return ()=>clearTimeout(t);
  },[localSearch,isComposing]);
  return (<div className="p-3 border rounded-xl bg-white">
    <div className="flex items-center gap-2">
      <Search className="w-4 h-4 text-gray-500" />
      <input value={localSearch} onChange={e=>setLocalSearch(e.target.value)}
        onCompositionStart={()=>setIsComposing(true)}
        onCompositionEnd={e=>{ setIsComposing(false); setLocalSearch((e.target as HTMLInputElement).value); }}
        placeholder="검색" className="flex-1 outline-none"/>
    </div>
  </div>);
}