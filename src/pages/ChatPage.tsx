// src/pages/ChatPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowUp, Loader2, RefreshCw, Copy, Save, ChevronsUpDown, Check, UploadCloud, FileText, X, BookMarked, CalendarDays, BrainCircuit } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import MarkdownRenderer from '../components/MarkdownRenderer';
import { useNotes, Subject } from '../lib/useNotes';
import { WeekPicker, getWeekNumber } from '../components/WeekPicker';
import { format } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import LoadingOverlay from '../components/LoadingOverlay'; // 👈 [버그 수정] LoadingOverlay 임포트

// ... (models, Message, GeminiHistory interfaces are the same) ...

export default function ChatPage() {
    // ... (All hooks, state, and functions remain the same as the previous correct version) ...

    const handleGenerateTextbook = async () => {
        // ...
        setIsLoading(true); // This will now correctly trigger the imported LoadingOverlay
        // ...
    };

    if (pageState === 'upload') {
        return (
            <>
                {isLoading && <LoadingOverlay message={loadingMessage} />}
                <div className="min-h-full w-full flex flex-col items-center justify-center p-4">
                    {/* ... The rest of the upload UI ... */}
                </div>
            </>
        );
    }

    // ... (The chat UI part of the component remains the same) ...
}