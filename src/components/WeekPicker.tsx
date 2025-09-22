import React, { useMemo } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { ko } from 'date-fns/locale';
import { getWeek } from 'date-fns';
import { useNotes } from '../lib/useNotes';
import { Badge } from './ui/badge';

interface WeekPickerProps {
  onDateSelect: (date: Date) => void;
}

export function WeekPicker({ onDateSelect }: WeekPickerProps) {
  const { schedule, allSubjects } = useNotes();

  const subjectsById = useMemo(() => {
    const map = new Map();
    allSubjects.forEach(sub => map.set(sub.id, sub));
    return map;
  }, [allSubjects]);

  const eventsByDayOfWeek = useMemo(() => {
    const grouped: { [key: number]: string[] } = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    schedule.forEach(event => {
      // "월" -> 1, "화" -> 2 ... "일" -> 0
      const dayIndex = ['일', '월', '화', '수', '목', '금', '토'].indexOf(event.dayOfWeek);
      if (dayIndex !== -1) {
        const subjectName = subjectsById.get(event.subjectId)?.name;
        if (subjectName && !grouped[dayIndex].includes(subjectName)) {
          grouped[dayIndex].push(subjectName);
        }
      }
    });
    return grouped;
  }, [schedule, subjectsById]);

  const DayContent = (props: { date: Date }) => {
    const dayIndex = props.date.getDay();
    const dailyEvents = eventsByDayOfWeek[dayIndex];
    return (
      <div className="relative flex flex-col items-center justify-center h-full">
        <span>{props.date.getDate()}</span>
        {dailyEvents && dailyEvents.length > 0 && (
          <div className="flex -space-x-1 overflow-hidden mt-1">
            {dailyEvents.slice(0, 2).map(eventName => (
               <Badge key={eventName} variant="secondary" className="text-[8px] p-0.5">{eventName.substring(0,2)}</Badge>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <DayPicker
      mode="single"
      onSelect={(date) => date && onDateSelect(date)}
      locale={ko}
      showOutsideDays
      fixedWeeks
      components={{ DayContent }}
      styles={{
        day: { height: '2.5rem', width: '2.5rem' },
      }}
    />
  );
}

// 선택된 날짜가 해당 연도의 몇 번째 주차인지 계산하는 헬퍼 함수
export function getWeekNumber(date: Date): number {
  return getWeek(date, { weekStartsOn: 1, firstWeekContainsDate: 4 });
}