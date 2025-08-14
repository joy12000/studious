import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useNotes } from '../lib/useNotes';
import { guessTopics } from '../lib/classify';
import TopicBadge from '../components/TopicBadge';
import { Save, ArrowLeft, Sparkles, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CapturePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addNote } = useNotes();
  
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [predictedTopics, setPredictedTopics] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  const allTopics = ['Productivity', 'Learning', 'Mindset', 'Health', 'Fitness', 'Finance', 'Career', 'Tech', 'Relationships', 'Creativity', 'Other'];

  useEffect(() => {
    // Get shared data from URL params (from Web Share Target)
    const sharedText = searchParams.get('text') || '';
    const sharedTitle = searchParams.get('title') || '';
    const sharedUrl = searchParams.get('url') || '';
    
    if (sharedTitle) { setTitle(sharedTitle); }
    if (sharedText) {
      setContent(sharedText);
    }
    if (sharedUrl) {
      setSourceUrl(sharedUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    // Predict topics when content changes
    if (content.trim()) {
      const predictTopics = async () => {
        const topics = await guessTopics(`${title}\n${content}`);
        setPredictedTopics(topics);
        setSelectedTopics(topics);
      };
      predictTopics();
    } else {
      setPredictedTopics([]);
      setSelectedTopics([]);
    }
  }, [content, title]);

  const handleTopicToggle = (topic: string) => {
    setSelectedTopics(prev => 
      prev.includes(topic)
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    );
  };

  const handleSave = async () => {
    if (!content.trim()) return;

    setLoading(true);
    try {
      const sourceType = sourceUrl.includes('youtube.com') || sourceUrl.includes('youtu.be') 
        ? 'youtube' 
        : sourceUrl 
          ? 'web' 
          : 'other';

      await addNote({
        title: title.trim() || undefined,
        content: content.trim(),
        sourceUrl: sourceUrl.trim() || undefined,
        sourceType
      });

      navigate('/');
    } catch (error) {
      console.error('Failed to save note:', error);
      alert('노트 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const canSave = content.trim().length > 0;

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
                <h1 className="text-xl font-semibold text-gray-900">새 노트 작성</h1>
                <p className="text-gray-600 text-sm">Perplexity 요약을 붙여넣고 저장하세요</p>
              </div>
            </div>
            
            <button
              onClick={handleSave}
              disabled={!canSave || loading}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                canSave && !loading
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Save className="h-4 w-4" />
              )}
              저장하기
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {/* Source URL */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              원문 링크 (선택사항)
            </label>
            <div className="relative">
              <ExternalLink className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... 또는 웹사이트 URL"
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Title */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              제목 (선택사항)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력하거나 비워두면 자동으로 생성됩니다"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Content */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              내용 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Perplexity에서 요약한 내용을 여기에 붙여넣기하세요...&#10;&#10;예시:&#10;- 핵심 포인트 1&#10;- 핵심 포인트 2&#10;- 실천할 내용&#10;&#10;이렇게 입력하면 자동으로 하이라이트와 할 일이 추출됩니다."
              rows={12}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <div className="mt-2 text-sm text-gray-500">
              {content.length} 글자
            </div>
          </div>

          {/* Topic Prediction */}
          {predictedTopics.length > 0 && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  AI가 예측한 주제
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {predictedTopics.map(topic => (
                  <TopicBadge 
                    key={topic} 
                    topic={topic} 
                    variant="default"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Topic Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              주제 선택
            </label>
            <div className="flex flex-wrap gap-2">
              {allTopics.map(topic => (
                <TopicBadge
                  key={topic}
                  topic={topic}
                  variant={selectedTopics.includes(topic) ? 'selected' : 'default'}
                  onClick={() => handleTopicToggle(topic)}
                />
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              클릭하여 주제를 선택하거나 해제할 수 있습니다.
            </p>
          </div>

          {/* Preview */}
          {content && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">미리보기</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-2">
                  {title || '자동 생성된 제목이 여기에 표시됩니다'}
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  선택된 주제: {selectedTopics.join(', ') || '없음'}
                </div>
                <div className="text-sm text-gray-700 line-clamp-3">
                  {content.slice(0, 200)}
                  {content.length > 200 && '...'}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}