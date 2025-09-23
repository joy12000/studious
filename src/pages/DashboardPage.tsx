// src/pages/DashboardPage.tsx
import React, { useMemo } from 'react';
import { useNotes } from '../lib/useNotes';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { BrainCircuit, GraduationCap, Youtube } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function DashboardPage() {
    const { notes, allSubjects } = useNotes();

    const stats = useMemo(() => {
        const noteCount = notes.length;
        const textbookCount = notes.filter(n => n.noteType === 'textbook').length;
        const reviewCount = notes.filter(n => n.noteType === 'review').length;
        const assignmentCount = notes.filter(n => n.noteType === 'assignment').length;

        const notesBySubject = allSubjects.map(subject => ({
            name: subject.name,
            count: notes.filter(note => note.subjectId === subject.id).length
        })).filter(item => item.count > 0)
           .sort((a, b) => b.count - a.count);
        
        return { noteCount, textbookCount, reviewCount, assignmentCount, notesBySubject };
    }, [notes, allSubjects]);

    const chartData = {
        labels: stats.notesBySubject.map(s => s.name),
        datasets: [
            {
                label: '노트 수',
                data: stats.notesBySubject.map(s => s.count),
                backgroundColor: 'hsl(var(--primary))',
                borderRadius: 4,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { display: false },
            title: { display: true, text: '과목별 노트 수' },
        },
        scales: {
            y: { ticks: { stepSize: 1 } }
        }
    };

    return (
        <div className="p-4 sm:p-8">
            <h1 className="text-3xl font-bold mb-6">학습 대시보드</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card>
                    <CardHeader><CardTitle>총 노트</CardTitle></CardHeader>
                    <CardContent><p className="text-4xl font-bold">{stats.noteCount}</p></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>AI 참고서</CardTitle>
                        <BrainCircuit className="w-6 h-6 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><p className="text-4xl font-bold">{stats.textbookCount}</p></CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>AI 과제</CardTitle>
                        <GraduationCap className="w-6 h-6 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><p className="text-4xl font-bold">{stats.assignmentCount}</p></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>YouTube 요약</CardTitle>
                        <Youtube className="w-6 h-6 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><p className="text-4xl font-bold">{notes.filter(n => n.noteType === 'general').length}</p></CardContent>
                </Card>
            </div>
            
            <Card>
                <CardContent className="pt-6">
                    {stats.notesBySubject.length > 0 ? (
                        <Bar options={chartOptions} data={chartData} />
                    ) : (
                        <p className="text-center text-muted-foreground">아직 과목별로 생성된 노트가 없습니다.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}