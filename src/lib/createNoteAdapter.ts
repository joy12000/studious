// Robust create-note adapter: tries multiple signatures and gracefully falls back to local save.
type CreateFn = (input: any) => any;

function getFn(mod: any): CreateFn | null {
  if (!mod) return null;
  if (typeof mod.safeCreateNote === "function") return mod.safeCreateNote as CreateFn;
  if (typeof mod.default === "function") return mod.default as CreateFn;
  if (typeof mod === "function") return mod as CreateFn;
  return null;
}

function titleFrom(content: string): string {
  const first = (content || "").split(/\n+/).map(s => s.trim()).find(Boolean) || "메모";
  return first.slice(0, 80);
}

function shapes(content: string): any[] {
  const title = titleFrom(content);
  const base = { content, title };
  return [
    content,
    { content },
    { text: content },
    { body: content },
    { raw: content },
    base,
    { ...base, topics: [] },
    { ...base, favorite: false },
    { note: content, title },
  ];
}

const ID_KEYS = ["id","key","uuid","noteId","_id","pk","primaryKey"];

function extractId(ret: any): string | null {
  if (ret == null) return null;
  if (typeof ret === "string" && ret.trim()) return ret.trim();
  if (typeof ret === "number") return String(ret);
  if (typeof ret === "object") {
    const c: any = ret;
    for (const k of ID_KEYS) {
      if (c[k] != null && String(c[k]).trim()) return String(c[k]).trim();
    }
    if (c.ok && (c.id || c.data?.id)) return String(c.id || c.data.id);
  }
  try { const s = String(ret); return s.trim() ? s.trim() : null; } catch { return null; }
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
  } catch {}
  return id;
}

export async function createNoteUniversal(moduleRef: any, contentInput: any): Promise<string> {
  const content = typeof contentInput === "string" ? contentInput : String(contentInput ?? "");
  const fn = getFn(moduleRef);
  if (!fn) {
    // No server function: local fallback
    return saveLocal(content);
  }
  for (const arg of shapes(content)) {
    try {
      const out = await Promise.resolve(fn(arg));
      const id = extractId(out);
      if (id) return id;
    } catch {
      // try next
    }
  }
  // As a last resort, local save
  return saveLocal(content);
}