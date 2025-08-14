import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../lib/db';
import { Note } from '../lib/types';
import { useNotes } from '../lib/useNotes';
import TopicBadge from '../components/TopicBadge';
import { 
  ArrowLeft, 
  Heart, 
  ExternalLink, 
  Calendar, 
  Edit2, 
  Check, 
  X,
  Star,
  Plus,
  Trash2
} from 'lucide-react';

export default function NotePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toggleFavorite, updateNote, deleteNote } = useNotes();
  
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    if (!id) return;
    
    const loadNote = async () => {
      try {
        const foundNote = await db.notes.get(id);
        if (foundNote) {
          setNote(foundNote);
          setEditContent(foundNote.content);
          setEditTitle(foundNote.title);
        } else {
          navigate('/');
        }
      } catch (error) {
        console.error('Error loading note:', error);
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    loadNote();
  }, [id, navigate]);

  const handleSaveEdit = async () => {
    if (!note || !id) return;
    
    await updateNote(id, {
      title: editTitle.trim(),
      content: editContent.trim()
    });
    
    setNote({ ...note, title: editTitle.trim(), content: editContent.trim() });
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(note?.content || '');
    setEditTitle(note?.title || '');
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!id) return;
    
    if (confirm('이 노트를 정말 삭제하시겠습니까?')) {
      await deleteNote(id);
      navigate('/');
    }
  };

  const toggleTodo = async (todoIndex: number) => {
    if (!note || !id) return;
    
    const updatedTodos = [...note.todo];
    updatedTodos[todoIndex] = {
      ...updatedTodos[todoIndex],
      done: !updatedTodos[todoIndex].done
    };
    
    await updateNote(id, { todo: updatedTodos });
    setNote({ ...note, todo: updatedTodos });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSourceIcon = (sourceType: Note['sourceType']) => {
    switch (sourceType) {
      case 'youtube':
        return '🎬';
      case 'book':
        return '📖';
      case 'web':
        return '🌐';
      default:
        return '📝';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">노트를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">노트를 찾을 수 없습니다.</p>
          <Link to="/" className="text-blue-600 hover:text-blue-700">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">노트 상세</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(!editing)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Edit2 className="h-5 w-5" />
              </button>
              <button
                onClick={() => toggleFavorite(note.id)}
                className={`p-2 rounded-lg transition-colors ${
                  note.favorite 
                    ? 'text-red-500 hover:bg-red-50' 
                    : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                }`}
              >
                {note.favorite ? <Heart className="h-5 w-5 fill-current" /> : <Heart className="h-5 w-5" />}
              </button>
              <button
                onClick={handleDelete}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {/* Meta Info */}
          <div className="flex items-center gap-4 mb-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(note.createdAt)}</span>
            </div>
            {note.sourceUrl && (
              <a 
                href={note.sourceUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-blue-600 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                원문 보기
              </a>
            )}
          </div>

          {/* Title */}
          <div className="mb-6">
            {editing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-2xl font-bold text-gray-900 border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            ) : (
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {getSourceIcon(note.sourceType)} {note.title}
              </h1>
            )}
          </div>

          {/* Topics */}
          <div className="flex flex-wrap gap-2 mb-6">
            {note.topics.map((topic) => (
              <TopicBadge key={topic} topic={topic} />
            ))}
          </div>

          {/* Content */}
          <div className="mb-8">
            {editing ? (
              <div>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={15}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={handleCancelEdit}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <X className="h-4 w-4" />
                    취소
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Check className="h-4 w-4" />
                    저장
                  </button>
                </div>
              </div>
            ) : (
              <div className="prose max-w-none">
                <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {note.content}
                </div>
              </div>
            )}
          </div>

          {/* Highlights */}
          {note.highlights.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                하이라이트
              </h3>
              <div className="space-y-2">
                {note.highlights.map((highlight, index) => (
                  <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="text-gray-700">{highlight.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Todo List */}
          {note.todo.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                ✅ 할 일
                <span className="text-sm text-gray-500 font-normal">
                  ({note.todo.filter(t => t.done).length}/{note.todo.length} 완료)
                </span>
              </h3>
              <div className="space-y-2">
                {note.todo.map((todo, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <button
                      onClick={() => toggleTodo(index)}
                      className={`mt-1 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        todo.done
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {todo.done && <Check className="h-3 w-3" />}
                    </button>
                    <span className={`flex-1 ${todo.done ? 'line-through text-gray-500' : 'text-gray-700'}`}>
                      {todo.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Labels */}
          {note.labels.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">라벨</h3>
              <div className="flex flex-wrap gap-2">
                {note.labels.map((label) => (
                  <span
                    key={label}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                  >
                    #{label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}