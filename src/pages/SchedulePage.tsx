import React, { useState, useMemo } from 'react';
import { useNotes } from '../lib/useNotes';
import { ScheduleEvent, Subject, Note } from '../lib/types';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import ScheduleImportButton from '../components/ScheduleImportButton';
import { ClassPortalModal } from '../components/ClassPortalModal';
import { format, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, isToday, getDay, addWeeks, subWeeks, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNavigate } from 'react-router-dom';

const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// --- Improved WeeklyEventCard ---
const WeeklyEventCard = ({ event, subjects, notes, onClick }: { event: ScheduleEvent, subjects: Subject[], notes: Note[], onClick: () => void }) => {
  const subject = subjects.find(s => s.id === event.subjectId);
  const relatedNotesCount = (notes || []).filter(n => n.subjectId === event.subjectId).length;

  const START_HOUR = 8; // 8 AM
  const TOTAL_HOURS = 15; // 8 AM to 11 PM

  const top = `${((timeToMinutes(event.startTime) - START_HOUR * 60) / (TOTAL_HOURS * 60)) * 100}%`;
  const height = `${((timeToMinutes(event.endTime) - timeToMinutes(event.startTime)) / (TOTAL_HOURS * 60)) * 100}%`;

  return (
    <div
      onClick={onClick}
      className="absolute w-[calc(100%-4px)] left-0.5 p-2 rounded-lg text-white transition-all shadow-md hover:shadow-lg hover:z-10 cursor-pointer overflow-hidden"
      style={{ top, height, backgroundColor: subject?.color || '#6b7280' }}
    >
      <p className="font-bold text-xs truncate">{subject?.name || '과목 없음'}</p>
      <p className="text-[10px] opacity-80">{event.startTime} - {event.endTime}</p>
      {relatedNotesCount > 0 && <p className="text-[10px] opacity-80 mt-1">노트 {relatedNotesCount}개</p>}
    </div>
  );
};

// --- Redesigned WeeklyCalendarView ---
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
                grouped[dayIndex] = [...(grouped[dayIndex] || []), event];
            }
        });
        return grouped;
    }, [schedule]);

    const timeSlots = Array.from({ length: 15 }, (_, i) => `${i + 8}:00`); // 8 AM to 10 PM

    return (
        <div className="flex-1 flex flex-col bg-card p-4 rounded-lg shadow-inner">
            <div className="flex items-center justify-between mb-4">
                <Button variant="outline" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                <h2 className="text-lg font-semibold">{format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'yyyy년 M월', { locale: ko })}</h2>
                <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 flex overflow-hidden">
                <div className="flex flex-col text-xs text-muted-foreground text-center">
                    {timeSlots.map(time => <div key={time} className="h-16 flex-shrink-0 pr-2 pt-[-4px]">{time}</div>)}
                </div>
                <div className="flex-1 grid grid-cols-7 border-l">
                    {weekDays.map((day) => (
                        <div key={day.toString()} className="flex flex-col border-r">
                            <div className={`text-center py-2 border-b ${isToday(day) ? 'bg-primary/10' : ''}`}>
                                <p className="text-sm font-medium">{['일', '월', '화', '수', '목', '금', '토'][getDay(day)]}</p>
                                <p className={`text-lg font-bold ${isToday(day) ? 'text-primary' : ''}`}>{format(day, 'd')}</p>
                            </div>
                            <div className="relative flex-1 bg-grid [background-size:100%_4rem]">
                                {Array.from({ length: 15 }).map((_, i) => <div key={i} className="h-16 border-b"></div>)}
                                {eventsByDay[getDay(day)]?.map(event => (
                                    <WeeklyEventCard key={event.id} event={event} subjects={allSubjects} notes={notes} onClick={() => onEventClick(event)} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};


// --- Improved MonthlyCalendarView ---
const MonthlyCalendarView = () => {
    const { notes, allSubjects } = useNotes();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const navigate = useNavigate();

    const noteDates = useMemo(() => {
        const dates = new Set<string>();
        (notes || []).forEach(note => {
            const dateKey = note.noteDate || format(new Date(note.createdAt), 'yyyy-MM-dd');
            dates.add(dateKey);
        });
        return dates;
    }, [notes]);
    
    const daysInGrid = eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 }),
        end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 })
    });

    const subjectsById = useMemo(() => new Map(allSubjects.map(s => [s.id, s])), [allSubjects]);

    const DayCell = ({ day }: { day: Date }) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const hasNote = noteDates.has(dateStr);
        const notesForDay = (notes || []).filter(note => (note.noteDate || format(new Date(note.createdAt), 'yyyy-MM-dd')) === dateStr);
        
        return (
            <Popover>
                <PopoverTrigger asChild>
                    <div className="h-28 border-t border-l p-1.5 flex flex-col cursor-pointer hover:bg-muted/50 transition-colors">
                        <span className={`text-xs ${isToday(day) ? 'font-bold text-primary' : ''} ${format(day, 'M') !== format(currentMonth, 'M') ? 'text-muted-foreground' : ''}`}>{format(day, 'd')}</span>
                        {hasNote && <div className="w-1.5 h-1.5 bg-primary rounded-full self-center mt-1"></div>}
                    </div>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                    <div className="p-4 border-b">
                        <h4 className="font-bold">{format(day, 'M월 d일 (eee)', { locale: ko })}</h4>
                        <p className="text-sm text-muted-foreground">총 {notesForDay.length}개의 학습 기록</p>
                    </div>
                    <div className="p-2 max-h-64 overflow-y-auto">
                        {notesForDay.length > 0 ? (
                            notesForDay.map(note => (
                                <div key={note.id} className="p-2 rounded-md hover:bg-muted cursor-pointer" onClick={() => navigate(`/note/${note.id}`)}>
                                    <p className="text-sm font-semibold truncate">{note.title}</p>
                                    <p className="text-xs text-muted-foreground">{subjectsById.get(note.subjectId!)?.name || "기타"}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">이 날의 노트가 없습니다.</p>
                        )}
                    </div>
                </PopoverContent>
            </Popover>
        );
    };
    
    const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];

    return (
        <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2 px-2">
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                <h2 className="text-lg font-semibold">{format(currentMonth, 'yyyy년 M월', { locale: ko })}</h2>
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="grid grid-cols-7 flex-1 border-r border-b rounded-lg overflow-hidden">
                {daysOfWeek.map(day => <div key={day} className="text-center font-medium text-xs py-2 border-l border-t bg-muted/30">{day}</div>)}
                {daysInGrid.map(day => <DayCell key={day.toString()} day={day} />)}
            </div>
        </div>
    );
};

// --- Main Page Component ---
export default function SchedulePage() {
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly');
  const { notes, allSubjects, schedule } = useNotes();
  
  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [portalTitle, setPortalTitle] = useState('');
  const [portalNotes, setPortalNotes] = useState<Note[]>([]);
  const [contextSubject, setContextSubject] = useState<Subject | undefined>();
  const [contextDate, setContextDate] = useState<Date | undefined>(); // ✨ [추가] 날짜 컨텍스트 상태


  const handleEventClick = (event: ScheduleEvent) => {
    const subject = allSubjects.find(s => s.id === event.subjectId);
    if (!subject) return;

    setPortalTitle(`${subject.name} 수업 포털`);
    setPortalNotes((notes || []).filter(n => n.subjectId === subject.id));
    setContextSubject(subject);
    // ✨ [개선] 주간 뷰에서는 오늘 날짜를 기본값으로 설정
    setContextDate(new Date()); 
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
            : <MonthlyCalendarView />}

        <ClassPortalModal 
            isOpen={isPortalOpen}
            onClose={() => setIsPortalOpen(false)}
            title={portalTitle}
            notes={portalNotes}
            subjects={allSubjects}
            contextSubject={contextSubject}
            contextDate={contextDate} // ✨ [개선] 날짜 컨텍스트 전달
        />
    </div>
  );
}