import React, { useState, useMemo } from 'react';
import { useNotes } from '../lib/useNotes';
import { ScheduleEvent, Subject } from '../lib/types';
import { Button } from '@/components/ui/button';
import { ScheduleEditModal } from '../components/ScheduleEditModal';
import ScheduleImportButton from '../components/ScheduleImportButton';

// --- Weekly View Components ---

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

// --- Helper Functions ---
const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const formatDate = (year: number, month: number, day: number) => {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

// --- Weekly View Components ---
const WeeklyEventCard = ({ event, subject, onClick }: { event: ScheduleEvent; subject?: Subject; onClick: () => void }) => {
  const startMinutes = timeToMinutes(event.startTime);
  const endMinutes = timeToMinutes(event.endTime);
  
  const top = (startMinutes / (24 * 60)) * 100;
  const height = ((endMinutes - startMinutes) / (24 * 60)) * 100;

  return (
    <div 
      className="absolute w-full flex items-start p-1 cursor-pointer" 
      style={{ top: `${top}%`, height: `${height}%` }}
      onClick={onClick}
    >
      <div className={`w-1 h-1 rounded-full mt-1 ${subject?.color ? '' : 'bg-primary'}`} style={{ backgroundColor: subject?.color }}></div>
      <div className="ml-1.5 -mt-1">
        <p className="text-xs font-semibold leading-tight">{subject?.name || '과목 없음'}</p>
        <p className="text-xs text-muted-foreground leading-tight">{event.startTime} - {event.endTime}</p>
      </div>
    </div>
  );
};

const WeeklyCalendarView = ({ onEventClick }: { onEventClick: (event: ScheduleEvent) => void }) => {
  const { schedule, allSubjects } = useNotes();

  const subjectsById = useMemo(() => {
    const map = new Map<string, Subject>();
    allSubjects?.forEach(sub => map.set(sub.id, sub));
    return map;
  }, [allSubjects]);

  const eventsByDay = useMemo(() => {
    const grouped: { [key: string]: ScheduleEvent[] } = {};
    DAYS.forEach(day => { grouped[day] = [] });
    schedule?.forEach(event => {
      if (grouped[event.dayOfWeek]) {
        grouped[event.dayOfWeek].push(event);
      }
    });
    for (const day in grouped) {
      grouped[day].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    }
    return grouped;
  }, [schedule]);

  return (
    <div className="flex-1 grid grid-cols-7 gap-2">
      {DAYS.map(day => (
        <div key={day} className="flex flex-col">
          <h2 className="text-center font-semibold mb-2">{day}</h2>
          <div className="relative flex-1 bg-muted/50 rounded-lg overflow-hidden">
            {[...Array(24)].map((_, i) => (
              <div key={i} className="h-10 border-b border-dashed border-muted/50"></div>
            ))}
            {eventsByDay[day]?.map(event => (
              <WeeklyEventCard key={event.id} event={event} subject={subjectsById.get(event.subjectId)} onClick={() => onEventClick(event)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// --- Monthly View Components ---
const MonthlyCalendarView = ({ onDayClick, onEventClick }: { onDayClick: (date: string) => void; onEventClick: (event: ScheduleEvent) => void }) => {
    const { schedule, allSubjects } = useNotes();
    const [currentDate, setCurrentDate] = useState(new Date());

    const subjectsById = useMemo(() => {
        const map = new Map<string, Subject>();
        allSubjects?.forEach(sub => map.set(sub.id, sub));
        return map;
    }, [allSubjects]);

    const eventsByDate = useMemo(() => {
        const grouped: { [key: string]: ScheduleEvent[] } = {};
        schedule?.forEach(event => {
            if (!event.date) return; // Guard against old data without a date
            if (!grouped[event.date]) {
                grouped[event.date] = [];
            }
            grouped[event.date].push(event);
        });
        for (const date in grouped) {
          grouped[date].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
        }
        return grouped;
    }, [schedule]);

    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDay = firstDayOfMonth.getDay(); // 0 for Sunday, 1 for Monday...
    const daysInMonth = lastDayOfMonth.getDate();

    const calendarDays = Array.from({ length: 42 }, (_, i) => {
        const dayIndex = i - (startDay === 0 ? 6 : startDay - 1);
        const date = new Date(firstDayOfMonth);
        date.setDate(dayIndex);
        return date;
    });

  return (
    <div className="grid grid-cols-7 gap-1">
        {['월', '화', '수', '목', '금', '토', '일'].map(day => (
            <div key={day} className="text-center font-semibold text-sm py-2">{day}</div>
        ))}
        {calendarDays.map((date, i) => {
            const dateString = formatDate(date.getFullYear(), date.getMonth(), date.getDate());
            const isCurrentMonth = date.getMonth() === currentDate.getMonth();
            
            const dailyEvents = eventsByDate[dateString] || [];

            return (
                <div key={i} className={`h-24 border rounded-lg p-1 text-xs ${isCurrentMonth ? 'bg-card/50' : 'bg-muted/20'}`} onClick={() => onDayClick(dateString)}>
                    <span className={`${isCurrentMonth ? '' : 'text-muted-foreground'}`}>{date.getDate()}</span>
                    <div className="mt-1 space-y-0.5 overflow-y-auto h-[calc(100%-1.25rem)]">
                        {dailyEvents.map(event => (
                            <div key={event.id} className="flex items-center cursor-pointer" onClick={(e) => { e.stopPropagation(); onEventClick(event); }}>
                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${subjectsById.get(event.subjectId)?.color ? '' : 'bg-primary'}`} style={{ backgroundColor: subjectsById.get(event.subjectId)?.color }}></div>
                                <span className="ml-1 text-xs truncate">{subjectsById.get(event.subjectId)?.name} {event.startTime}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )
        })}
    </div>
  );
};

export default function SchedulePage() {
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly');
  const { allSubjects, addScheduleEvent, updateScheduleEvent, deleteScheduleEvent } = useNotes();
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);

  const handleDayClick = async (date: string) => {
    const subjectId = prompt('과목 ID를 입력하세요:\n' + allSubjects?.map(s => `${s.name}: ${s.id}`).join('\n'));
    if (!subjectId) return;

    const startTime = prompt('시작 시간을 입력하세요 (HH:MM):');
    if (!startTime) return;

    const endTime = prompt('종료 시간을 입력하세요 (HH:MM):');
    if (!endTime) return;

    const dayIndex = new Date(date).getDay();
    const dayOfWeek = DAYS[(dayIndex + 6) % 7];

    await addScheduleEvent({ date, subjectId, startTime, endTime, dayOfWeek });
  };

  const handleEventClick = (event: ScheduleEvent) => {
    setEditingEvent(event);
  };

  const handleUpdateSchedule = async (id: string, updates: Partial<ScheduleEvent>) => {
    await updateScheduleEvent(id, updates);
  };

  const handleDeleteSchedule = async (id: string) => {
    await deleteScheduleEvent(id);
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
        {view === 'weekly' ? <WeeklyCalendarView onEventClick={handleEventClick} /> : <MonthlyCalendarView onDayClick={handleDayClick} onEventClick={handleEventClick} />}
        {editingEvent && (
          <ScheduleEditModal 
            event={editingEvent}
            onClose={() => setEditingEvent(null)}
            onSave={handleUpdateSchedule}
            onDelete={handleDeleteSchedule}
          />
        )}
    </div>
  );
}