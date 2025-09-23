import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// ...

export default function ChatPage() {
    const navigate = useNavigate();
    const location = useLocation(); // location 훅 사용
    // ...
    const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    // ...
    
    // ✨ [핵심 추가] 페이지 진입 시 SchedulePage에서 보낸 상태(state)를 확인
    useEffect(() => {
        if (location.state) {
            if (location.state.subject) {
                setSelectedSubject(location.state.subject);
            }
            if (location.state.date) {
                setSelectedDate(location.state.date);
            }
        }
    }, [location.state]);

    // ... (나머지 코드는 이전과 동일)
}