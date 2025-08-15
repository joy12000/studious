// Tries multiple signatures & return shapes for safeCreateNote
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
  const base = { content, title, topics: [] as string[] };
  return [
    content,
    { content },
    { text: content },
    { body: content },
    { raw: content },
    base,
    { ...base, favorites: false },
    { note: content, title },
  ];
}
function extractId(ret: any): string | null {
  if (ret == null) return null;
  if (typeof ret === "string" && ret.trim()) return ret.trim();
  if (typeof ret === "number") return String(ret);
  if (typeof ret === "object") {
    const c = ret as any;
    const cand = c.id ?? c.key ?? c.uuid ?? c.noteId ?? c._id ?? c.pk ?? c.primaryKey;
    if (cand != null && String(cand).trim()) return String(cand).trim();
    if (c.ok && (c.id || c.data?.id)) return String(c.id || c.data.id);
  }
  try { const s = String(ret); return s.trim() ? s.trim() : null; } catch { return null; }
}

export async function createNoteUniversal(moduleRef: any, content: string): Promise<string> {
  const fn = getFn(moduleRef);
  if (!fn) throw new Error("safeCreateNote function not found");
  for (const arg of shapes(content)) {
    try {
      const out = await Promise.resolve(fn(arg));
      const id = extractId(out);
      if (id) return id;
    } catch {
      // try next
    }
  }
  throw new Error("safeCreateNote returned empty id");
}
