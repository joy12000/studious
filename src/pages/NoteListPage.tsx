import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotes } from '../lib/useNotes';
import NoteCard from '../components/NoteCard';
import { Plus, LayoutGrid, List, Search, X, Folder as FolderIcon, BrainCircuit, RefreshCw, Home } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { useAuth } from '@clerk/clerk-react';
import { syncNotes } from '../lib/sync';
import toast from 'react-hot-toast';
import { Subject, Folder } from '../lib/types';

// New FolderCard component
const FolderCard = ({ folder, onDoubleClick, onDragOver, onDrop, isRenaming, newName, onNameChange, onRename, onCancelRename }) => (
  <div 
    className="relative group bg-muted/50 p-4 rounded-lg flex flex-col items-center justify-center aspect-square transition-all hover:bg-muted cursor-pointer"
    onDoubleClick={onDoubleClick}
    onDragOver={onDragOver}
    onDrop={onDrop}
  >
    <FolderIcon className="w-16 h-16 text-yellow-500" />
    {isRenaming ? (
      <input 
        type="text"
        value={newName}
        onChange={onNameChange}
        onBlur={onCancelRename}
        onKeyDown={(e) => e.key === 'Enter' && onRename()}
        className="mt-2 w-full text-center bg-transparent border border-primary rounded-md"
        autoFocus
      />
    ) : (
      <p className="mt-2 text-sm font-medium text-center break-all">{folder.name}</p>
    )}
  </div>
);

export default function NoteListPage() {
  const { notes, allSubjects, allFolders, loading, filters, setFilters, toggleFavorite, addFolder, updateFolder, moveNoteToFolder } = useNotes();
  const navigate = useNavigate();
  const { getToken, userId } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);

  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [localSearch, setLocalSearch] = useState(filters.search || '');

  // State for folder navigation
  const [currentSubjectId, setCurrentSubjectId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [breadcrumbs, setBreadcrumbs] = useState<(Subject | Folder)[]>([]);

  // State for UI interactions
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingFolderName, setRenamingFolderName] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setFilters({ ...filters, search: localSearch || undefined });
    }, 300);
    return () => clearTimeout(handler);
  }, [localSearch, setFilters]);

  const handleSubjectSelect = (subject: Subject) => {
    setCurrentSubjectId(subject.id);
    setCurrentFolderId(undefined);
    setBreadcrumbs([subject]);
  };

  const handleFolderClick = (folder: Folder) => {
    setCurrentFolderId(folder.id);
    const newBreadcrumbs = [];
    let current: Folder | Subject | undefined = folder;
    let currentParentId = folder.parentId;
    
    const folderMap = new Map(allFolders.map(f => [f.id, f]));
    const subjectMap = new Map(allSubjects.map(s => [s.id, s]));

    newBreadcrumbs.unshift(current);

    while(currentParentId) {
      const parentFolder = folderMap.get(currentParentId);
      if(parentFolder) {
        newBreadcrumbs.unshift(parentFolder);
        currentParentId = parentFolder.parentId;
      } else {
        break;
      }
    }
    
    const rootSubject = subjectMap.get(folder.subjectId);
    if(rootSubject) newBreadcrumbs.unshift(rootSubject);

    setBreadcrumbs(newBreadcrumbs);
  };

  const handleBreadcrumbClick = (item: Subject | Folder, index: number) => {
    if (index === 0) { // Root subject
      setCurrentFolderId(undefined);
    } else { // A folder
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
  };

  const handleDropOnFolder = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    const noteId = e.dataTransfer.getData('noteId');
    if (noteId) {
      moveNoteToFolder(noteId, folderId);
    }
  };

  const handleDropOnCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    const noteId = e.dataTransfer.getData('noteId');
    if (noteId) {
      moveNoteToFolder(noteId, currentFolderId);
    }
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
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b p-4">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          {/* Breadcrumbs */}
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
        className="flex-1 overflow-y-auto p-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDropOnCanvas}
      >
        <div className="max-w-7xl mx-auto">
          {(loading || isSyncing) && <p>로딩 중...</p>}
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {/* Render Folders */}
            {filteredFolders.map(folder => (
              <FolderCard 
                key={folder.id} 
                folder={folder} 
                onDoubleClick={() => handleFolderClick(folder)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDropOnFolder(e, folder.id)}
                isRenaming={renamingFolderId === folder.id}
                newName={renamingFolderName}
                onNameChange={(e) => setRenamingFolderName(e.target.value)}
                onRename={handleRenameFolder}
                onCancelRename={() => setRenamingFolderId(null)}
              />
            ))}

            {/* Render New Folder Input */}
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

            {/* Render Notes */}
            {filteredNotesInCurrentView.map(n => (
              <div key={n.id} draggable onDragStart={(e) => handleDragStart(e, n.id)}>
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
  );
}