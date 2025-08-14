import { useState, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { db } from './db';
import { Note } from './types';
import { guessTopics, generateTitle, extractHighlights, extractTodos } from './classify';

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    topics: [] as string[],
    dateRange: 'all' as 'today' | '7days' | '30days' | 'all',
    favorite: false
  });

  
  // Reload when filters change
  useEffect(() => { loadNotes(); }, [filters.search, filters.favorite, filters.dateRange, (filters.topics||[]).join('|')]);
const loadNotes = async () => {
    setLoading(true);
    try {
      let query = db.notes.orderBy('createdAt').reverse();
      
      // Apply filters
      if (filters.favorite) {
        query = query.filter(note => note.favorite);
      }
      
      if (filters.topics.length > 0) {
        query = query.filter(note => 
          filters.topics.some(topic => note.topics.includes(topic))
        );
      }
      
      if (filters.dateRange !== 'all') {
        const now = new Date();
        let cutoffDate: Date;
        
        switch (filters.dateRange) {
          case 'today':
            cutoffDate = new Date(now.setHours(0, 0, 0, 0));
            break;
          case '7days':
            cutoffDate = new Date(now.setDate(now.getDate() - 7));
            break;
          case '30days':
            cutoffDate = new Date(now.setDate(now.getDate() - 30));
            break;
          default:
            cutoffDate = new Date(0);
        }
        
        query = query.filter(note => new Date(note.createdAt) >= cutoffDate);
      }
      
      let results = await query.toArray();
      
      // Search filter
      if (filters.search.trim()) {
        const searchTerm = filters.search.toLowerCase();
        results = results.filter(note =>
          note.title.toLowerCase().includes(searchTerm) ||
          note.content.toLowerCase().includes(searchTerm) ||
          (note.sourceUrl||'').toLowerCase().includes(searchTerm) ||
          note.topics.some(topic => topic.toLowerCase().includes(searchTerm)) ||
          note.labels.some(label => label.toLowerCase().includes(searchTerm))
        );
      }
      
      setNotes(results);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const addNote = async (params: {
    title?: string;
    content: string;
    sourceUrl?: string;
    sourceType?: Note['sourceType'];
  }) => {
    const id = uuid();
    const createdAt = new Date().toISOString();
    const topics = await guessTopics(`${params.title || ''}\n${params.content}`);
    const title = params.title || generateTitle(params.content);
    const highlights = extractHighlights(params.content);
    const todo = extractTodos(params.content);
    
    const sourceType = params.sourceType || 
      (params.sourceUrl?.includes('youtube.com') || params.sourceUrl?.includes('youtu.be') ? 'youtube' : 
       params.sourceUrl ? 'web' : 'other');
    
    const note: Note = {
      id,
      title,
      content: params.content,
      sourceType,
      sourceUrl: params.sourceUrl || null,
      createdAt,
      topics,
      labels: [],
      highlights,
      todo,
      favorite: false
    };
    
    await db.notes.add(note);
    await loadNotes();
    return id;
  };

  const updateNote = async (id: string, updates: Partial<Note>) => {
    await db.notes.update(id, updates);
    await loadNotes();
  };

  const deleteNote = async (id: string) => {
    await db.notes.delete(id);
    await loadNotes();
  };

  const toggleFavorite = async (id: string) => {
    const note = await db.notes.get(id);
    if (note) {
      await db.notes.update(id, { favorite: !note.favorite });
      await loadNotes();
    }
  };

  const exportData = async () => {
    const allNotes = await db.notes.toArray();
    const settings = await db.settings.get('default');
    
    const exportData = {
      notes: allNotes,
      settings,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `selfdev-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.notes && Array.isArray(data.notes)) {
        // Clear existing data
        await db.notes.clear();
        
        // Import notes
        for (const note of data.notes) {
          await db.notes.add(note);
        }
        
        // Import settings if available
        if (data.settings) {
          await db.settings.put({ ...data.settings, id: 'default' });
        }
        
        await loadNotes();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  };

  useEffect(() => {
    loadNotes();
  }, [filters]);

  return {
    notes,
    loading,
    filters,
    setFilters,
    addNote,
    updateNote,
    deleteNote,
    toggleFavorite,
    exportData,
    importData,
    refresh: loadNotes
  };
}