// src/components/ClassPortalModal.tsx

import React, { useMemo, useState } from 'react';
import { Note, Subject } from '../lib/types';
import { Button } from './ui/button';
import { X, BrainCircuit, Notebook, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'; // ✨ Card 컴포넌트 임포트

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  notes: Note[];
  subjects: Subject[];
  contextSubject?: Subject;
}

const NoteItem = ({ note, subjectName }: { note: Note; subjectName: string }) => {
  const navigate = useNavigate();
  return (
    <div 
      className="p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
      onClick={() => navigate(`/note/${note.id}`)}
    >
      <div className="flex justify-between items-center mb-1">
        <span className="font-semibold text-sm truncate">{note.title}</span>
        <span className="text-xs text-muted-foreground">{subjectName}</span>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{note.content.replace(/#+\s/g, '')}</p>
    </div>
  );
};

export const ClassPortalModal: React.FC<Props> = ({ isOpen, onClose, title, notes, subjects, contextSubject }) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'textbook' | 'review' | undefined>();

  const subjectsById = useMemo(() => {
    const map = new Map<string, Subject>();
    subjects.forEach(sub => map.set(sub.id, sub));
    return map;
  }, [subjects]);

  const filteredAndGroupedNotes = useMemo(() => {
    // ... (이전과 동일한 필터링 및 그룹화 로직)
  }, [notes, filter]);
  
  const handleGoToChat = () => {
    navigate('/chat', { state: { subject: contextSubject } });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-lg h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </CardHeader>

        <div className="px-6 pb-4 border-b">
          <ToggleGroup /* ... (필터 UI 동일) ... */ />
        </div>

        <CardContent className="flex-1 overflow-y-auto p-2">
          {filteredAndGroupedNotes.length > 0 ? (
            <div className="space-y-4">
              {filteredAndGroupedNotes.map(([dateStr, dateNotes]) => (
                <div key={dateStr}>
                  <div className="px-3 py-1 text-xs font-semibold text-muted-foreground sticky top-0 bg-card/80 backdrop-blur-sm">{dateStr}</div>
                  <div className="divide-y divide-border/50">
                    {dateNotes.map(note => (
                       <NoteItem key={note.id} note={note} subjectName={subjectsById.get(note.subjectId!)?.name || "알 수 없음"} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground pt-16">
              <p>해당하는 노트가 없습니다.</p>
            </div>
          )}
        </CardContent>

        {contextSubject && (
            <footer className="p-4 border-t grid grid-cols-2 gap-2 flex-shrink-0">
                {/* ... (푸터 버튼 동일) ... */}
            </footer>
        )}
      </Card>
    </div>
  );
};