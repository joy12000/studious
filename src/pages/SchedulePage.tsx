// src/pages/SchedulePage.tsx

import React, { useState, useMemo } from 'react';
import { useNotes } from '../lib/useNotes';
import { ScheduleEvent, Subject, Note } from '../lib/types';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ScheduleImportButton from '../components/ScheduleImportButton';
import { ClassPortalModal } from '../components/ClassPortalModal'; // ✨ [추가] 포털 모달 임포트
import { format, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, addDays, isToday, getDay, addWeeks, subWeeks, startOfMonth, endOfMonth, eachWeekOfInterval } from 'date-fns';
import { Link } from 'react-router-dom';

const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const formatDate = (date: Date) => format(date, 'M월 d일');

const WeeklyEventCard = ({ event, subjects, notes }: { event: ScheduleEvent, subjects: Subject[], notes: Note[] }) => {
  const subject = subjects.find(s => s.id === event.subjectId);
  const relatedNotes = notes.filter(n => n.subjectId === event.subjectId);

  const top = `${((timeToMinutes(event.startTime) - 480) / (1320 - 480)) * 100}%`;
  const height = `${((timeToMinutes(event.endTime) - timeToMinutes(event.startTime)) / (1320 - 480)) * 100}%`;

  return (
    <div
      className="absolute w-full p-2 rounded-lg shadow-md text-white transition-all hover:scale-105 hover:z-10"
      style={{ top, height, backgroundColor: subject?.color || '#6b7280' }}
    >
      <p className="font-bold text-sm truncate">{subject?.name || '과목 없음'}</p>
      <p className="text-xs">{event.startTime} - {event.endTime}</p>
      {relatedNotes.length > 0 && <p className="text-xs mt-1">관련 노트: {relatedNotes.length}개</p>}
    </div>
  );
};

const WeeklyCalendarView = ({ onEventClick }: { onEventClick: (event: ScheduleEvent) => void }) => {
    const { schedule, allSubjects, notes } = useNotes();
    const [currentWeek, setCurrentWeek] = useState(new Date());

    const weekDays = eachDayOfInterval({ start: startOfWeek(currentWeek, { weekStartsOn: 1 }), end: endOfWeek(currentWeek, { weekStartsOn: 1 }) });
    const dayOfWeekMap: { [key: string]: number } = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 0 };

    const eventsByDay = useMemo(() => {
        const grouped: { [key: number]: ScheduleEvent[] } = {};
        weekDays.forEach(day => grouped[getDay(day)] = []);
        schedule.forEach(event => {
            const dayIndex = dayOfWeekMap[event.dayOfWeek];
            if (dayIndex !== undefined) {
                grouped[dayIndex] = [...(grouped[dayIndex] || []), event].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
            }
        });
        return grouped;
    }, [schedule, currentWeek]);

    const timeSlots = Array.from({ length: 14 }, (_, i) => `${i + 8}:00`);

    return (
        <div className="flex-1 flex flex-col bg-card p-4 rounded-lg shadow-inner">
            <div className="flex items-center justify-between mb-4">
                <Button variant="outline" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                <h2 className="text-lg font-semibold">{format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'yyyy년 M월')}</h2>
                <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-7 gap-px bg-border -ml-4 -mr-4 -mb-4 p-px overflow-hidden">
                {weekDays.map((day, index) => (
                    <div key={day.toString()} className="flex flex-col bg-card">
                        <div className={`text-center py-2 border-b ${isToday(day) ? 'text-primary font-bold' : ''}`}>
                            <p className="text-sm font-medium">{['일', '월', '화', '수', '목', '금', '토'][getDay(day)]}</p>
                            <p className={`text-lg ${isToday(day) ? 'text-primary' : ''}`}>{format(day, 'd')}</p>
                        </div>
                        <div className="relative flex-1 hidden md:block">
                            {eventsByDay[getDay(day)]?.map(event => (
                                <div key={event.id} onClick={() => onEventClick(event)} className="cursor-pointer">
                                    <WeeklyEventCard event={event} subjects={allSubjects} notes={notes} />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const MonthlyCalendarView = ({ onDayClick, onEventClick }: { onDayClick: (date: Date) => void; onEventClick: (event: ScheduleEvent) => void }) => {
    const { schedule, allSubjects, notes } = useNotes();
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const weeks = eachWeekOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }, { weekStartsOn: 1 });

    const eventsByDate = useMemo(() => {
        const grouped: { [key: string]: ScheduleEvent[] } = {};
        schedule.forEach(event => {
            const dateKey = event.date; // Assuming event.date is "YYYY-MM-DD"
            if (!grouped[dateKey]) grouped[dateKey] = [];
            grouped[dateKey].push(event);
        });
        return grouped;
    }, [schedule]);

    return (
        <div className="flex-1 flex flex-col bg-card p-4 rounded-lg shadow-inner">
            <div className="flex items-center justify-between mb-4">
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(prev => addDays(prev, -30))}><ChevronLeft className="h-4 w-4" /></Button>
                <h2 className="text-lg font-semibold">{format(currentMonth, 'yyyy년 M월')}</h2>
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(prev => addDays(prev, 30))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="grid grid-cols-7 flex-1 gap-px bg-border -mx-4 -mb-4">
                <div className="text-center text-xs font-bold py-2 bg-card border-b">월</div>
                <div className="text-center text-xs font-bold py-2 bg-card border-b">화</div>
                <div className="text-center text-xs font-bold py-2 bg-card border-b">수</div>
                <div className="text-center text-xs font-bold py-2 bg-card border-b">목</div>
                <div className="text-center text-xs font-bold py-2 bg-card border-b">금</div>
                <div className="text-center text-xs font-bold py-2 bg-card border-b">토</div>
                <div className="text-center text-xs font-bold py-2 bg-card border-b">일</div>
                {weeks.map(weekStart => 
                    eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) }).map(day => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const dayEvents = eventsByDate[dateKey] || [];
                        const dayNotes = notes.filter(note => isSameDay(new Date(note.createdAt), day));
                        return (
                            <div key={day.toString()} className="bg-card p-1.5 flex flex-col min-h-[6rem] cursor-pointer" onClick={() => onDayClick(day)}>
                                <span className={`font-semibold ${isToday(day) ? 'text-primary' : ''}`}>{format(day, 'd')}</span>
                                <div className="flex-1 space-y-1 mt-1 overflow-hidden">
                                    {dayEvents.map(event => {
                                        const subject = allSubjects.find(s => s.id === event.subjectId);
                                        return (
                                            <div key={event.id} onClick={(e) => { e.stopPropagation(); onEventClick(event); }} className="text-xs p-1 rounded-md text-white truncate" style={{ backgroundColor: subject?.color || '#6b7280' }}>
                                                {subject?.name}
                                            </div>
                                        );
                                    })}
                                    {dayNotes.length > 0 && (
                                        <div className="text-xs p-1 rounded-md bg-muted text-muted-foreground truncate">
                                            노트 {dayNotes.length}개
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default function SchedulePage() {
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly');
  const { notes, allSubjects, schedule, updateScheduleEvent, deleteScheduleEvent } = useNotes();
  
  // ✨ [추가] 모달 상태 관리
  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [portalTitle, setPortalTitle] = useState('');
  const [portalNotes, setPortalNotes] = useState<Note[]>([]);
  const [contextSubject, setContextSubject] = useState<Subject | undefined>();


  const handleEventClick = (event: ScheduleEvent) => {
    const subject = allSubjects.find(s => s.id === event.subjectId);
    if (!subject) return;

    setPortalTitle(`${subject.name} 수업 포털`);
    setPortalNotes(notes.filter(n => n.subjectId === subject.id));
    setContextSubject(subject);
    setIsPortalOpen(true);
  };

  // ✨ [개선] 월간 뷰 날짜 클릭 핸들러
  const handleDayClick = (date: Date) => {
    const notesForDay = notes.filter(note => isSameDay(new Date(note.createdAt), date));
    
    setPortalTitle(`${format(date, 'M월 d일')} 학습 기록`);
    setPortalNotes(notesForDay);
    setContextSubject(undefined); // 날짜 기준이므로 특정 과목 컨텍스트는 없음
    setIsPortalOpen(true);
  };

  return (
    <div className="p-4 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">시간표</h1>
            <div className="flex items-center gap-4">
              <ScheduleImportButton />
              <div className="flex items-center gap-2 p-1 rounded-full bg-muted">
                  <Button onClick={() => setView('weekly')} variant={view === 'weekly' ? 'primary' : 'ghost'} size="sm" className="rounded-full">주간</Button>
                  <Button onClick={() => setView('monthly')} variant={view === 'monthly' ? 'primary' : 'ghost'} size="sm" className="rounded-full">월간</Button>
              </div>
            </div>
        </div>
        
        {view === 'weekly' 
            ? <WeeklyCalendarView onEventClick={handleEventClick} /> 
            : <MonthlyCalendarView onDayClick={handleDayClick} onEventClick={handleEventClick} />}

        {/* ✨ [추가] 포털 모달 렌더링 */}
        <ClassPortalModal 
            isOpen={isPortalOpen}
            onClose={() => setIsPortalOpen(false)}
            title={portalTitle}
            notes={portalNotes}
            subjects={allSubjects}
            contextSubject={contextSubject}
        />
    </div>
  );
}
