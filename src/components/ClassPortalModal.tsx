import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  notes: any[]; // Use a more specific type if available
  subjects: any[]; // Use a more specific type if available
  contextSubject?: any; // Use a more specific type if available
}

export const ClassPortalModal: React.FC<Props> = ({ isOpen, onClose, title, notes, subjects, contextSubject }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card w-full max-w-lg h-[80vh] rounded-2xl shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <header className="p-4 border-b flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose}>X</button>
        </header>
        <main className="flex-1 overflow-y-auto p-4">
          <p>This is a placeholder for ClassPortalModal.</p>
          <p>Title: {title}</p>
          <p>Notes count: {notes.length}</p>
          <p>Subjects count: {subjects.length}</p>
          {contextSubject && <p>Context Subject: {contextSubject.name}</p>}
        </main>
      </div>
    </div>
  );
};