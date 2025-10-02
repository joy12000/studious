import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotes } from '../lib/useNotes';
import NoteCard from '../components/NoteCard';
import { Plus, LayoutGrid, List, Search, X, Folder as FolderIcon, BrainCircuit, RefreshCw, Home, Edit, Trash2 } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { useAuth } from '@clerk/clerk-react';
import { syncNotes } from '../lib/sync';
import toast from 'react-hot-toast';
import { Subject, Folder } from '../lib/types';

// FolderCard component with context menu and rename logic
const FolderCard = ({ folder, onDoubleClick, onDragOver, onDrop, onContextMenu, isRenaming, newName, onNameChange, onRenameConfirm, onRenameCancel }) => (
  <div 
    className="relative group bg-muted/50 p-4 rounded-lg flex flex-col items-center justify-center aspect-square transition-all hover:bg-muted cursor-pointer"
    onDoubleClick={onDoubleClick}
    onDragOver={onDragOver}
    onDrop={onDrop}
    onContextMenu={onContextMenu}
  >
    <FolderIcon className="w-16 h-16 text-yellow-500 pointer-events-none" />
    {isRenaming ? (
      <input 
        type="text"
        value={newName}
        onChange={onNameChange}
        onBlur={onRenameCancel}
        onKeyDown={(e) => e.key === 'Enter' && onRenameConfirm()}
        className="mt-2 w-full text-center bg-transparent border border-primary rounded-md z-10"
        autoFocus
        onClick={(e) => e.stopPropagation()} // Prevent double click from firing
      />
    ) : (
      <p className="mt-2 text-sm font-medium text-center break-all pointer-events-none">{folder.name}</p>
    )}
  </div>
);

// Context Menu Component
const ContextMenu = ({ x, y, visible, folder, onRename, onDelete, onClose }) => {
  if (!visible) return null;
  return (
    <div 
      className="fixed z-50 bg-background border rounded-md shadow-lg p-1"
      style={{ top: y, left: x }}
      onClick={onClose} // Close on click inside menu
    >
      <button onClick={() => onRename(folder)} className="flex items-center w-full text-left px-3 py-1.5 text-sm hover:bg-muted rounded-sm">
        <Edit className="w-4 h-4 mr-2" /> 이름 변경
      </button>
      <button onClick={() => onDelete(folder)} className="flex items-center w-full text-left px-3 py-1.5 text-sm text-destructive hover:bg-destructive hover:text-destructive-foreground rounded-sm">
        <Trash2 className="w-4 h-4 mr-2" /> 삭제
      </button>
    </div>
  );
};

export default function NoteListPage() {
  const { notes, allSubjects, allFolders, loading, toggleFavorite, addFolder, updateFolder, deleteFolder, moveNoteToFolder } = useNotes();
  const navigate = useNavigate();

  // State for folder navigation
  const [currentSubjectId, setCurrentSubjectId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [breadcrumbs, setBreadcrumbs] = useState<(Subject | Folder)[]>([]);

  // State for UI interactions
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingFolderName, setRenamingFolderName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; folder: Folder | null }>({ visible: false, x: 0, y: 0, folder: null });

  // Close context menu on any click
  useEffect(() => {
    const handleClick = () => setContextMenu({ ...contextMenu, visible: false });
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  const handleSubjectSelect = (subject: Subject) => {
    setCurrentSubjectId(subject.id);
    setCurrentFolderId(undefined);
    setBreadcrumbs([subject]);
  };

  const handleFolderClick = (folder: Folder) => {
    setCurrentFolderId(folder.id);
    // This breadcrumb logic can be simplified, but works for now
    const newCrumbs = [...breadcrumbs, folder];
    setBreadcrumbs(newCrumbs);
  };

  const handleBreadcrumbClick = (item: Subject | Folder, index: number) => {
    if (index === 0) {
      setCurrentFolderId(undefined);
    } else {
      setCurrentFolderId((item as Folder).id);
    }
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
  };

  const handleGoHome = () => {
    setCurrentSubjectId(null);
    setCurrentFolderId(undefined);
    setBreadcrumbs([]);
  }

  const handleCreateFolder = async () => {
    if (newFolderName.trim() && currentSubjectId) {
      await addFolder(newFolderName.trim(), currentSubjectId, currentFolderId);
      setIsCreatingFolder(false);
      setNewFolderName('');
    }
  };

  const startRename = (folder: Folder) => {
    setRenamingFolderId(folder.id);
    setRenamingFolderName(folder.name);
  };

  const handleRenameFolder = async () => {
    if (renamingFolderId && renamingFolderName.trim()) {
      await updateFolder(renamingFolderId, { name: renamingFolderName.trim() });
    }
    setRenamingFolderId(null);
    setRenamingFolderName('');
  };

  const handleDeleteFolder = async (folder: Folder) => {
    if (window.confirm(`'${folder.name}' 폴더를 정말 삭제하시겠습니까? 폴더 안의 노트는 상위 폴더로 이동됩니다.`)) {
      await deleteFolder(folder.id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, folder: Folder) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, folder });
  };

  // Filter items for the current view
  const { filteredFolders, filteredNotesInCurrentView } = useMemo(() => {
    if (!currentSubjectId) {
      return { filteredFolders: [], filteredNotesInCurrentView: [] };
    }
    const foldersInView = allFolders.filter(f => f.subjectId === currentSubjectId && f.parentId === currentFolderId);
    const notesInView = notes.filter(n => n.subjectId === currentSubjectId && n.folderId === currentFolderId);
    return { filteredFolders: foldersInView, filteredNotesInCurrentView: notesInView };
  }, [currentSubjectId, currentFolderId, allFolders, notes]);

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, noteId: string) => {
    e.dataTransfer.setData('noteId', noteId);
    setIsDragging(true);
  };
  
  const handleDragEnd = () => {
      setIsDragging(false);
  }

  const handleDropOnFolder = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const noteId = e.dataTransfer.getData('noteId');
    if (noteId) {
      moveNoteToFolder(noteId, folderId);
    }
    setIsDragging(false);
  };

  const handleDropOnCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    const noteId = e.dataTransfer.getData('noteId');
    if (noteId) {
      // Move to current folder level (or subject root if currentFolderId is undefined)
      moveNoteToFolder(noteId, currentFolderId);
    }
    setIsDragging(false);
  };

  if (!currentSubjectId) {
    return (
      <div className="p-4 sm:p-8">
        <h1 className="text-2xl font-bold mb-6">과목 선택</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {allSubjects.map(subject => (
            <div key={subject.id} onClick={() => handleSubjectSelect(subject)} className="bg-muted/50 p-4 rounded-lg flex flex-col items-center justify-center aspect-square transition-all hover:bg-muted cursor-pointer">
              <BrainCircuit className="w-16 h-16" style={{ color: subject.color || '#ccc' }} />
              <p className="mt-2 text-sm font-medium text-center break-all">{subject.name}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <ContextMenu {...contextMenu} onRename={startRename} onDelete={handleDeleteFolder} onClose={() => setContextMenu({ ...contextMenu, visible: false })} />
      <div className="flex h-full flex-col">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b p-4">
          <div className="max-w-7xl mx-auto flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Button variant="ghost" size="icon" onClick={handleGoHome} className="h-6 w-6"><Home className="h-4 w-4"/></Button>
              <span>/</span>
              {breadcrumbs.map((item, index) => (
                <React.Fragment key={item.id}>
                  <button onClick={() => handleBreadcrumbClick(item, index)} className="hover:text-foreground">
                    {item.name}
                  </button>
                  <span>/</span>
                </React.Fragment>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold">{breadcrumbs[breadcrumbs.length - 1]?.name || '노트'}</h1>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setIsCreatingFolder(true)} title="새 폴더">
                  <FolderIcon className="h-5 w-5" /><Plus className="h-3 w-3 -ml-2 -mt-3"/>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main 
          className={`flex-1 overflow-y-auto p-4 transition-colors ${isDragging ? 'bg-primary/10' : ''}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropOnCanvas}
        >
          <div className="max-w-7xl mx-auto">
            {loading && <p>로딩 중...</p>}
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredFolders.map(folder => (
                <FolderCard 
                  key={folder.id} 
                  folder={folder} 
                  onDoubleClick={() => handleFolderClick(folder)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropOnFolder(e, folder.id)}
                  onContextMenu={(e) => handleContextMenu(e, folder)}
                  isRenaming={renamingFolderId === folder.id}
                  newName={renamingFolderName}
                  onNameChange={(e) => setRenamingFolderName(e.target.value)}
                  onRenameConfirm={handleRenameFolder}
                  onRenameCancel={() => setRenamingFolderId(null)}
                />
              ))}

              {isCreatingFolder && (
                <div className="bg-muted/50 p-4 rounded-lg flex flex-col items-center justify-center aspect-square">
                  <FolderIcon className="w-16 h-16 text-yellow-500 opacity-50" />
                  <input 
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                    onBlur={() => { setIsCreatingFolder(false); setNewFolderName(''); }}
                    placeholder="폴더 이름"
                    className="mt-2 w-full text-center bg-transparent border border-primary rounded-md"
                    autoFocus
                  />
                </div>
              )}

              {filteredNotesInCurrentView.map(n => (
                <div key={n.id} draggable onDragStart={(e) => handleDragStart(e, n.id)} onDragEnd={handleDragEnd}>
                  <NoteCard note={n} onToggleFavorite={toggleFavorite} view={'grid'} />
                </div>
              ))}
            </div>

            {!loading && filteredFolders.length === 0 && filteredNotesInCurrentView.length === 0 && !isCreatingFolder && (
               <div className="text-center text-muted-foreground py-20">
                <h2 className="text-lg font-semibold">폴더나 노트가 없습니다</h2>
                <p className="mt-2">새 폴더나 노트를 만들어보세요.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}