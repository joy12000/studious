import React, { useState, useMemo } from 'react';
import { ScheduleEvent, Subject } from '../lib/types';
import { useNotes } from '../lib/useNotes';
import { Button } from './ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { X } from 'lucide-react';

interface Props {
  event: ScheduleEvent;
  onClose: () => void;
  onSave: (id: string, updates: Partial<ScheduleEvent>) => void;
  onDelete: (id: string) => void;
}

export const ScheduleEditModal: React.FC<Props> = ({ event, onClose, onSave, onDelete }) => {
  const { allSubjects } = useNotes();
  const [startTime, setStartTime] = useState(event.startTime);
  const [endTime, setEndTime] = useState(event.endTime);

  const subjectName = useMemo(() => {
    return allSubjects?.find(s => s.id === event.subjectId)?.name || '과목 없음';
  }, [allSubjects, event.subjectId]);

  const handleSave = () => {
    onSave(event.id, { startTime, endTime });
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm(`'${subjectName}' 일정을 정말로 삭제하시겠습니까?`)) {
      onDelete(event.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <Card className="w-[90vw] max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            일정 수정
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="font-semibold text-lg">{subjectName}</div>
          <div className="space-y-2">
            <label htmlFor="startTime" className="text-sm font-medium">시작 시간</label>
            <input
              id="startTime"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full p-2 border rounded-md bg-background"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="endTime" className="text-sm font-medium">종료 시간</label>
            <input
              id="endTime"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full p-2 border rounded-md bg-background"
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="destructive" onClick={handleDelete}>삭제</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>취소</Button>
            <Button onClick={handleSave}>저장</Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};
