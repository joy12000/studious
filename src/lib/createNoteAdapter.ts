import { safeCreateNote } from './safeCreateNote';

// Robust create-note adapter: tries multiple signatures and gracefully falls back to local save.
function titleFrom(content: string): string {
  const first = (content || "").split(/\n+/).map(s => s.trim()).find(Boolean) || "메모";
  return first.slice(0, 80);
}

function saveLocal(content: string): string {
  const title = titleFrom(content);
  const id = `local-${Date.now()}-${title.replace(/\s+/g,"-").toLowerCase().slice(0,24) || "note"}`;
  try {
    const note = { id, content, title, createdAt: Date.now(), updatedAt: Date.now() };
    localStorage.setItem(`note:${id}`, JSON.stringify(note));
    const idxRaw = localStorage.getItem("note:index");
    const index = idxRaw ? JSON.parse(idxRaw) : [];
    index.unshift({ id, title, createdAt: Date.now() });
    localStorage.setItem("note:index", JSON.stringify(index.slice(0,500)));
    localStorage.setItem("note:lastSaved", id);
  } catch (e) {
    console.error("saveLocal failed:", e);
  } 
  return id;
}

export async function createNoteUniversal(contentInput: any): Promise<string> {
  const content = typeof contentInput === "string" ? contentInput : String(contentInput ?? "");

  try {
    const id = await safeCreateNote(content);
    console.log("createNoteUniversal: safeCreateNote returned", id);
    if (id) return id;
  } catch (e) {
    console.error("createNoteUniversal: safeCreateNote failed", e);
    // Fallback to local save if safeCreateNote fails
  }
  // As a last resort, local save
  const localId = saveLocal(content);
  console.log("createNoteUniversal: saveLocal returned", localId);
  return localId;
}