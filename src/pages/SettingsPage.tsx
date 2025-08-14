import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotes } from '../lib/useNotes';
import { ArrowLeft, Download, Upload, Trash2 } from 'lucide-react';

export default function SettingsPage() {
  const { exportData, importData, notes } = useNotes();
  const [importing, setImporting] = useState(false);

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const success = await importData(file);
      if (success) {
        alert('데이터를 성공적으로 가져왔습니다!');
      } else {
        alert('잘못된 파일 형식입니다.');
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('데이터 가져오기에 실패했습니다.');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const handleExport = async () => {
    try {
      await exportData();
    } catch (error) {
      console.error('Export error:', error);
      alert('데이터 내보내기에 실패했습니다.');
    }
  };

  const clearAllData = async () => {
    if (!confirm('모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }
    
    try {
      const { db } = await import('../lib/db');
      await db.notes.clear();
      alert('모든 데이터가 삭제되었습니다.');
      window.location.reload();
    } catch (error) {
      console.error('Clear data error:', error);
      alert('데이터 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">설정</h1>
              <p className="text-gray-600 text-sm">데이터 관리 및 앱 설정</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* 앱 정보 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">앱 정보</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">전체 노트 수</span>
                <span className="font-medium">{notes.length}개</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">즐겨찾기</span>
                <span className="font-medium">{notes.filter(n => n.favorite).length}개</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">총 할 일</span>
                <span className="font-medium">
                  {notes.reduce((acc, note) => acc + note.todo.length, 0)}개
                </span>
              </div>
            </div>
          </div>

          {/* 데이터 관리 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">데이터 관리</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">내보내기</h3>
                <p className="text-sm text-gray-600 mb-3">
                  모든 노트와 설정을 JSON 파일로 내보냅니다.
                </p>
                <button
                  onClick={handleExport}
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  데이터 내보내기
                </button>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-2">가져오기</h3>
                <p className="text-sm text-gray-600 mb-3">
                  이전에 내보낸 JSON 파일을 선택하여 데이터를 복원합니다.
                </p>
                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    disabled={importing}
                    className="sr-only"
                    id="import-file"
                  />
                  <label
                    htmlFor="import-file"
                    className={`inline-flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer ${
                      importing ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {importing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                        가져오는 중...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        파일 선택
                      </>
                    )}
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* PWA 설치 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">앱 설치</h2>
            <p className="text-gray-600 mb-4">
              이 웹앱을 홈 화면에 설치하여 네이티브 앱처럼 사용할 수 있습니다.
            </p>
            <div className="space-y-3 text-sm text-gray-600">
              <div>
                <strong>Android/Chrome:</strong> 브라우저 메뉴 → "홈 화면에 추가" 또는 "앱 설치"
              </div>
              <div>
                <strong>iOS/Safari:</strong> 공유 버튼 → "홈 화면에 추가"
              </div>
              <div>
                <strong>공유 기능:</strong> 설치 후 다른 앱에서 "공유" → "SelfDev Notes" 선택하여 직접 노트 추가 가능
              </div>
            </div>
          </div>

          {/* 위험 구역 */}
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
            <h2 className="text-lg font-semibold text-red-900 mb-4">위험 구역</h2>
            <div>
              <h3 className="font-medium text-red-900 mb-2">모든 데이터 삭제</h3>
              <p className="text-sm text-red-600 mb-3">
                모든 노트와 설정을 완전히 삭제합니다. 이 작업은 되돌릴 수 없습니다.
              </p>
              <button
                onClick={clearAllData}
                className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                모든 데이터 삭제
              </button>
            </div>
          </div>

          {/* 사용 팁 */}
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-4">사용 팁</h2>
            <div className="space-y-3 text-sm text-blue-800">
              <div>
                <strong>Perplexity 활용:</strong> YouTube 링크나 책 제목을 Perplexity에 입력 → "요약해줘" → 결과를 복사하여 앱에 붙여넣기
              </div>
              <div>
                <strong>자동 분류:</strong> 텍스트에 포함된 키워드를 바탕으로 자동으로 주제를 분류합니다
              </div>
              <div>
                <strong>할 일 추출:</strong> "~해야 한다", "실천하라" 등의 패턴을 인식하여 자동으로 할 일 목록을 생성합니다
              </div>
              <div>
                <strong>검색:</strong> 제목, 내용, 주제, 라벨 모두에서 검색이 가능합니다
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}