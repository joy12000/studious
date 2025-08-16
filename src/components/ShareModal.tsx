
import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// COMMENT: 공유 시 4자리 PIN을 입력받기 위한 모달 컴포넌트

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pin: string) => void;
  noteTitle: string;
}

export default function ShareModal({ isOpen, onClose, onConfirm, noteTitle }: ShareModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // COMMENT: 모달이 열릴 때마다 input에 포커스를 주고, 상태를 초기화합니다.
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
      // setTimeout을 사용하여 모달이 렌더링된 후 포커스를 줍니다.
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // COMMENT: 사용자가 '공유 시작' 버튼을 눌렀을 때 실행됩니다.
  const handleSubmit = () => {
    if (/^\d{4}$/.test(pin)) {
      onConfirm(pin);
    } else {
      setError('반드시 4자리 숫자를 입력해야 합니다.');
      inputRef.current?.focus();
    }
  };

  // COMMENT: Enter 키를 눌렀을 때도 공유가 시작되도록 합니다.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  // COMMENT: 모달이 닫혀있으면 아무것도 렌더링하지 않습니다.
  if (!isOpen) {
    return null;
  }

  return (
    // 배경 (Backdrop)
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* 모달 컨텐츠 */}
      <div
        className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm m-4"
        onClick={(e) => e.stopPropagation()} // 모달 내부 클릭 시 닫히지 않도록 함
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">노트 공유 암호 설정</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>
        
        <p className="text-gray-600 mb-2">
          공유할 노트 "<strong className="truncate max-w-xs inline-block align-bottom">{noteTitle}</strong>"를 암호화할 4자리 숫자 PIN을 입력하세요.
        </p>
        
        <input
          ref={inputRef}
          type="tel" // 모바일에서 숫자 키패드가 뜨도록 tel 타입 사용
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} // 숫자만 입력되도록 필터링
          onKeyDown={handleKeyDown}
          className={`w-full text-center text-3xl tracking-[1em] font-mono border-2 ${error ? 'border-red-500' : 'border-gray-300'} rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition`}
          placeholder="••••"
        />
        
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

        <button
          onClick={handleSubmit}
          className="w-full mt-6 bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-transform active:scale-[0.98]"
        >
          공유 시작
        </button>
      </div>
    </div>
  );
}
