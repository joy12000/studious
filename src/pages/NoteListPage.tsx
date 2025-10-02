import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotes } from '../lib/useNotes';
import NoteCard from '../components/NoteCard';
import { Plus, Folder as FolderIcon, BrainCircuit, RefreshCw, Home, Edit, Trash2, Inbox, Notebook, ArrowUpFromLine, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Subject, Folder, Note } from '../lib/types';

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
        onClick={(e) => e.stopPropagation()}
      />
    ) : (
      <p className="mt-2 text-sm font-medium text-center break-all pointer-events-none">{folder.name}</p>
    )}
  </div>
);

const ContextMenu = ({ x, y, visible, children, onClose }) => {
  if (!visible) return null;
  return (
    <div 
      className="fixed z-50 bg-background border rounded-md shadow-lg p-1"
      style={{ top: y, left: x }}
      onClick={onClose}
    >
      {children}
    </div>
  );
};

const UNCLASSIFIED_ID = '__unclassified__';

export default function NoteListPage() {
  const { notes, allSubjects, allFolders, loading, toggleFavorite, addFolder, updateFolder, deleteFolder, moveNoteToFolder, importNote, handleSync, setFilters, filters } = useNotes();
  const navigate = useNavigate();

  const [currentSubjectId, setCurrentSubjectId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [breadcrumbs, setBreadcrumbs] = useState<(Subject | Folder)[]>([]);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingFolderName, setRenamingFolderName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [folderContextMenu, setFolderContextMenu] = useState<{ visible: boolean; x: number; y: number; folder: Folder | null }>({ visible: false, x: 0, y: 0, folder: null });
  const [noteContextMenu, setNoteContextMenu] = useState<{ visible: boolean; x: number; y: number; note: Note | null }>({ visible: false, x: 0, y: 0, note: null });
  const [canvasContextMenu, setCanvasContextMenu] = useState<{ visible: boolean; x: number; y: number; }>({ visible: false, x: 0, y: 0 });
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handleClick = () => {
      setFolderContextMenu(prev => ({ ...prev, visible: false }));
      setNoteContextMenu(prev => ({ ...prev, visible: false }));
      setCanvasContextMenu(prev => ({ ...prev, visible: false }));
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setFilters({ ...filters, search: searchQuery || undefined });
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery, setFilters]);

  const onSyncClick = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    await handleSync();
    setIsSyncing(false);
  };

  const handleSubjectSelect = (subject: Subject | {id: string, name: string}) => {
    setCurrentSubjectId(subject.id);
    setCurrentFolderId(undefined);
    setBreadcrumbs([subject as Subject]);
  };

  const handleFolderClick = (folder: Folder) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs(prev => [...prev, folder]);
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index < breadcrumbs.length - 1) {
        setCurrentFolderId(index === 0 ? undefined : (breadcrumbs[index] as Folder).id);
        setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    }
  };

  const handleGoHome = () => {
    setCurrentSubjectId(null);
    setCurrentFolderId(undefined);
    setBreadcrumbs([]);
    setSearchQuery(''); // Clear search when going home
  }

  const handleCreateFolder = async () => {
    if (newFolderName.trim() && currentSubjectId && currentSubjectId !== UNCLASSIFIED_ID) {
      await addFolder(newFolderName.trim(), currentSubjectId, currentFolderId);
    }
    setIsCreatingFolder(false);
    setNewFolderName('');
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

  const handleNoteContextMenu = (e: React.MouseEvent, note: Note) => {
    e.preventDefault();
    e.stopPropagation();
    setNoteContextMenu({ visible: true, x: e.clientX, y: e.clientY, note });
  };

  const handleFolderContextMenu = (e: React.MouseEvent, folder: Folder) => {
    e.preventDefault();
    e.stopPropagation();
    setFolderContextMenu({ visible: true, x: e.clientX, y: e.clientY, folder });
  };

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return; // Only fire on the main canvas itself
    e.preventDefault();
    e.stopPropagation();
    setCanvasContextMenu({ visible: true, x: e.clientX, y: e.clientY });
  };

  const handleMoveNoteToParent = (note: Note) => {
    if (!note.folderId) return; // Already at the root of the subject
    const currentFolder = allFolders.find(f => f.id === note.folderId);
    moveNoteToFolder(note.id, currentFolder?.parentId);
  };

  const handleAddNewEmptyNote = async () => {
    const newNote = await importNote({
      title: '빈 노트',
      content: '# 제목\n\n',
      subjectId: currentSubjectId === UNCLASSIFIED_ID ? undefined : currentSubjectId,
      folderId: currentFolderId,
    });
    navigate(`/note/${newNote.id}`);
  };

  const { filteredFolders, filteredNotesInCurrentView } = useMemo(() => {
    if (!currentSubjectId) return { filteredFolders: [], filteredNotesInCurrentView: [] };
    const isUnclassified = currentSubjectId === UNCLASSIFIED_ID;
    const foldersInView = isUnclassified ? [] : allFolders.filter(f => f.subjectId === currentSubjectId && f.parentId === currentFolderId);
    const notesInView = notes.filter(n => {
      const subjectMatch = isUnclassified ? (n.subjectId == null) : n.subjectId === currentSubjectId;
      return subjectMatch && n.folderId === currentFolderId;
    });
    return { filteredFolders: foldersInView, filteredNotesInCurrentView: notesInView };
  }, [currentSubjectId, currentFolderId, allFolders, notes]);

  const handleDragStart = (e: React.DragEvent, noteId: string) => {
    e.dataTransfer.setData('noteId', noteId);
    setIsDragging(true);
  };
  
  const handleDragEnd = () => setIsDragging(false);

  const handleDropOnFolder = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const noteId = e.dataTransfer.getData('noteId');
    if (noteId) moveNoteToFolder(noteId, folderId);
    setIsDragging(false);
  };

  const handleDropOnCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    const noteId = e.dataTransfer.getData('noteId');
    if (noteId && currentSubjectId !== UNCLASSIFIED_ID) moveNoteToFolder(noteId, currentFolderId);
    setIsDragging(false);
  };

  const renderContent = () => {
    if (searchQuery) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {notes.map(n => (
            <NoteCard key={n.id} note={n} onToggleFavorite={toggleFavorite} view={'grid'} />
          ))}
        </div>
      );
    }

    if (!currentSubjectId) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {allSubjects.map(subject => (
            <div key={subject.id} onClick={() => handleSubjectSelect(subject)} className="bg-muted/50 p-4 rounded-lg flex flex-col items-center justify-center aspect-square transition-all hover:bg-muted cursor-pointer">
              <BrainCircuit className="w-16 h-16" style={{ color: subject.color || '#ccc' }} />
              <p className="mt-2 text-sm font-medium text-center break-all">{subject.name}</p>
            </div>
          ))}
          <div key={UNCLASSIFIED_ID} onClick={() => handleSubjectSelect({ id: UNCLASSIFIED_ID, name: '미분류' })} className="bg-muted/50 p-4 rounded-lg flex flex-col items-center justify-center aspect-square transition-all hover:bg-muted cursor-pointer">
            <Inbox className="w-16 h-16 text-slate-500" />
            <p className="mt-2 text-sm font-medium text-center break-all">미분류 노트</p>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredFolders.map(folder => (
          <FolderCard 
            key={folder.id} 
            folder={folder} 
            onDoubleClick={() => handleFolderClick(folder)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDropOnFolder(e, folder.id)}
            onContextMenu={(e) => handleFolderContextMenu(e, folder)}
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
          <div key={n.id} draggable onDragStart={(e) => handleDragStart(e, n.id)} onDragEnd={handleDragEnd} onContextMenu={(e) => handleNoteContextMenu(e, n)}>
            <NoteCard note={n} onToggleFavorite={toggleFavorite} view={'grid'} />
          </div>
        ))}

        {!loading && filteredFolders.length === 0 && filteredNotesInCurrentView.length === 0 && !isCreatingFolder && (
            <div className="text-center text-muted-foreground py-20">
            <h2 className="text-lg font-semibold">폴더나 노트가 없습니다</h2>
            <p className="mt-2">새 폴더나 노트를 만들어보세요.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <ContextMenu {...folderContextMenu} onClose={() => setFolderContextMenu(prev => ({...prev, visible: false}))}>
        {folderContextMenu.folder && (
          <>
            <button onClick={() => startRename(folderContextMenu.folder!)} className="flex items-center w-full text-left px-3 py-1.5 text-sm hover:bg-muted rounded-sm">
              <Edit className="w-4 h-4 mr-2" /> 이름 변경
            </button>
            <button onClick={() => handleDeleteFolder(folderContextMenu.folder!)} className="flex items-center w-full text-left px-3 py-1.5 text-sm text-destructive hover:bg-destructive hover:text-destructive-foreground rounded-sm">
              <Trash2 className="w-4 h-4 mr-2" /> 삭제
            </button>
          </>
        )}
      </ContextMenu>
      <ContextMenu {...noteContextMenu} onClose={() => setNoteContextMenu(prev => ({...prev, visible: false}))}>
        {noteContextMenu.note && (
          <button onClick={() => handleMoveNoteToParent(noteContextMenu.note!)} className="flex items-center w-full text-left px-3 py-1.5 text-sm hover:bg-muted rounded-sm">
            <ArrowUpFromLine className="w-4 h-4 mr-2" /> 상위 폴더로 이동
          </button>
        )}
      </ContextMenu>
      <ContextMenu {...canvasContextMenu} onClose={() => setCanvasContextMenu(prev => ({...prev, visible: false}))}>
          <button onClick={handleAddNewEmptyNote} className="flex items-center w-full text-left px-3 py-1.5 text-sm hover:bg-muted rounded-sm">
            <Notebook className="w-4 h-4 mr-2" /> 새 노트 만들기
          </button>
          {currentSubjectId && currentSubjectId !== UNCLASSIFIED_ID && (
            <button onClick={() => setIsCreatingFolder(true)} className="flex items-center w-full text-left px-3 py-1.5 text-sm hover:bg-muted rounded-sm">
              <FolderIcon className="w-4 h-4 mr-2" /> 새 폴더 만들기
            </button>
          )}
      </ContextMenu>

      <div className="flex h-full flex-col">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b p-4">
          <div className="max-w-7xl mx-auto flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground flex-grow">
                    <Button variant="ghost" size="icon" onClick={handleGoHome} className="h-6 w-6"><Home className="h-4 w-4"/></Button>
                    <span>/
                    </span>
                    {breadcrumbs.map((item, index) => (
                        <React.Fragment key={item.id}>
                        <button onClick={() => handleBreadcrumbClick(index)} className="hover:text-foreground">
                            {item.name}
                        </button>
                        <span>/
                        </span>
                        </React.Fragment>
                    ))}
                </div>
                <div className="relative flex-grow-0 sm:flex-grow sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="전체 노트 검색..."
                        className="w-full pl-9 pr-8 py-2 border bg-background rounded-full text-sm"
                    />
                    {searchQuery && (
                        <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearchQuery('')}>
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold">{searchQuery ? `'${searchQuery}' 검색 결과` : breadcrumbs[breadcrumbs.length - 1]?.name || '노트'}</h1>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handleAddNewEmptyNote} title="새 노트">
                    <Notebook className="h-5 w-5" />
                </Button>
                {currentSubjectId && currentSubjectId !== UNCLASSIFIED_ID && (
                  <Button variant="outline" size="icon" onClick={() => setIsCreatingFolder(true)} title="새 폴더">
                    <FolderIcon className="h-5 w-5" /><Plus className="h-3 w-3 -ml-2 -mt-3"/>
                  </Button>
                )}
                 <Button variant="outline" size="icon" onClick={onSyncClick} disabled={isSyncing} title="Supabase와 동기화">
                    <RefreshCw className={`h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main 
          className={`flex-1 overflow-y-auto p-4 transition-colors ${isDragging ? 'bg-primary/10' : ''}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropOnCanvas}
          onContextMenu={handleCanvasContextMenu}
        >
          <div className="max-w-7xl mx-auto">
            {loading ? <p>로딩 중...</p> : renderContent()}
          </div>
        </main>
      </div>
    </>
  );
}