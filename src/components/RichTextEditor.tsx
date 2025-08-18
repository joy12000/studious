import React, { useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, Strikethrough, List, ListOrdered } from 'lucide-react';
import { cleanPaste } from '../lib/cleanPaste';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
}

export interface EditorHandle {
  insertContent: (content: string) => void;
  setContent: (content: string) => void;
}

const Toolbar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 p-2 border-b tiptap-toolbar">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={editor.isActive('bold') ? 'is-active' : ''}
        aria-label="Bold"
      >
        <Bold className="w-5 h-5" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={editor.isActive('italic') ? 'is-active' : ''}
        aria-label="Italic"
      >
        <Italic className="w-5 h-5" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        className={editor.isActive('strike') ? 'is-active' : ''}
        aria-label="Strikethrough"
      >
        <Strikethrough className="w-5 h-5" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={editor.isActive('bulletList') ? 'is-active' : ''}
        aria-label="Bullet List"
      >
        <List className="w-5 h-5" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={editor.isActive('orderedList') ? 'is-active' : ''}
        aria-label="Ordered List"
      >
        <ListOrdered className="w-5 h-5" />
      </button>
    </div>
  );
};

const RichTextEditor = forwardRef<EditorHandle, RichTextEditorProps>(({ content, onChange }, ref) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none p-4 focus:outline-none',
      },
      handlePaste: (view, event) => {
        event.preventDefault();
        
        async function processPaste() {
          if (event.clipboardData) {
            const cleanedText = await cleanPaste(event.clipboardData);
            editor?.chain().focus().insertContent(cleanedText, {
              parseOptions: {
                preserveWhitespace: 'full',
              }
            }).run();
          }
        }
        
        processPaste();
        return true;
      },
    },
  });

  useImperativeHandle(ref, () => ({
    insertContent: (newContent: string) => {
      editor?.chain().focus().insertContent(newContent).run();
    },
    setContent: (newContent: string) => {
      editor?.commands.setContent(newContent, true);
    },
  }));

  return (
    <div className="border rounded-lg">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="min-h-[200px]" />
    </div>
  );
});

export default RichTextEditor;
