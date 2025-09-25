import React, { useMemo, useState, useEffect } from 'react';
import { useNotes } from '../lib/useNotes';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { BrainCircuit, GraduationCap, Youtube } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function DashboardPage() {
    const { notes, allSubjects } = useNotes();
    const [theme, setTheme] = useState(localStorage.getItem('pref-theme') || 'light');

    // 테마 변경 감지 (옵션)
    useEffect(() => {
        const observer = new MutationObserver(() => {
            const newTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
            setTheme(newTheme);
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);


    const stats = useMemo(() => {
        const noteCount = notes.length;
        const textbookCount = notes.filter(n => n.noteType === 'textbook').length;
        const reviewCount = notes.filter(n => n.noteType === 'review').length;
        const assignmentCount = notes.filter(n => n.noteType === 'assignment').length;

        const notesBySubject = allSubjects.map(subject => ({
            name: subject.name,
            count: notes.filter(note => note.subjectId === subject.id).length
        })).sort((a, b) => b.count - a.count);
        
        return { noteCount, textbookCount, reviewCount, assignmentCount, notesBySubject };
    }, [notes, allSubjects]);

    const chartData = useMemo(() => ({
        labels: stats.notesBySubject.map(s => s.name),
        datasets: [
            {
                label: '노트 수',
                data: stats.notesBySubject.map(s => s.count),
                backgroundColor: stats.notesBySubject.map(s => allSubjects.find(sub => sub.name === s.name)?.color || (theme === 'dark' ? 'hsl(210 70% 60%)' : 'hsl(222.2 47.4% 11.2%)')),
                borderRadius: 4,
            },
        ],
    }), [stats.notesBySubject, allSubjects, theme]);

    const chartOptions = useMemo(() => {
        const textColor = theme === 'dark' ? 'hsl(210 20% 95%)' : 'hsl(222.2 84% 4.9%)';
        const gridColor = theme === 'dark' ? 'hsl(215 15% 20%)' : 'hsl(214.3 31.8% 91.4%)';

        return {
            maintainAspectRatio: false, // 👈 [버그 수정] 컨테이너 크기에 맞추도록 설정
            responsive: true,
            plugins: {
                legend: { display: false },
                title: { display: true, text: '과목별 노트 수', color: textColor, font: { size: 16 } },
                tooltip: {
                    backgroundColor: theme === 'dark' ? 'hsl(220 25% 15%)' : 'hsl(0 0% 100%)',
                    titleColor: textColor,
                    bodyColor: textColor,
                }
            },
            scales: {
                y: {
                    ticks: { color: textColor, stepSize: 1 },
                    grid: { color: gridColor }
                },
                x: {
                    ticks: { color: textColor },
                    grid: { color: 'transparent' }
                }
            }
        };
    }, [theme]);

    return (
        <div className="p-4 sm:p-8">
            <h1 className="text-3xl font-bold mb-6">학습 대시보드</h1>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">총 노트</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.noteCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">AI 참고서</CardTitle>
                        <BrainCircuit className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.textbookCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">AI 과제</CardTitle>
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.assignmentCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">YouTube 요약</CardTitle>
                        <Youtube className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{notes.filter(n => n.noteType === 'general').length}</div>
                    </CardContent>
                </Card>
            </div>
            
            <Card>
                <CardContent className="pt-6">
                    {/* 👈 [버그 수정] 차트를 고정된 높이의 div로 감싸서 크기 문제 해결 */}
                    <div className="relative h-[400px]">
                        {stats.notesBySubject.length > 0 ? (
                            <Bar options={chartOptions} data={chartData} />
                        ) : (
                            <p className="text-center text-muted-foreground pt-16">아직 과목별로 생성된 노트가 없습니다.</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}