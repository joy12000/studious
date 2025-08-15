// Runtime auto-discovery for create-note function across various file names/exports.
let cached: { mod: any; fn: (arg: any) => any; name: string } | null = null;

// Known export names we will look for, in order.
const CANDIDATE_EXPORTS = [
  "safeCreateNote",
  "createNote",
  "saveNote",
  "addNote",
  "upsertNote",
  "default",
];

// Known file name patterns (relative to this file). Vite will tree-shake unused but the glob list is static.
const loaders = {
  // canonical
  ...import.meta.glob("../**/safeCreateNote.{ts,tsx}"),
  ...import.meta.glob("../**/*safeCreateNote*.{ts,tsx}"),
  // common note modules
  ...import.meta.glob("../**/*note*.{ts,tsx}"),
  ...import.meta.glob("../**/*notes*.{ts,tsx}"),
  ...import.meta.glob("../**/db/*.{ts,tsx}"),
};

export async function getNoteCreator(): Promise<{ mod: any; fn: (arg: any) => any; name: string } | null> {
  if (cached) return cached;
  const entries = Object.entries(loaders);
  for (const [path, loader] of entries) {
    try {
      const mod: any = await (loader as any)();
      for (const key of CANDIDATE_EXPORTS) {
        const f = mod?.[key];
        if (typeof f === "function") {
          cached = { mod, fn: f as (arg: any) => any, name: `${path}#${key}` };
          return cached;
        }
      }
    } catch {
      // ignore and continue
    }
  }
  return null;
}
