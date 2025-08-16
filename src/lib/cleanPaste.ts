// Smart paste cleaner: preserves code fences, normalizes lists, strips UTM params.
export function cleanPaste(raw?: unknown): string {
  // Coerce to string defensively
  let source = '';
  if (typeof raw === 'string') source = raw;
  else if (raw == null) source = '';
  else source = String(raw);

  if (!source) return '';

  const segments = splitByCodeFences(source);
  const cleaned = segments.map(seg => {
    if (seg.isCode) return seg.text; // leave code blocks as-is
    let t = seg.text;

    // Normalize newlines
    t = t.replace(/\r\n?/g, "\n");

    // Replace smart quotes
    t = t
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'");

    // Zero-width chars and weird spaces
    t = t.replace(/[\u200B-\u200D\uFEFF]/g, "");
    t = t.replace(/[\u00A0]/g, " ");

    // Normalize bullet points
    t = t.split("\n").map(line => {
      // bullets like • · ▪ ◦ - or spaces before them
      const bullet = /^\s*[•·▪◦\-\*]\s+/u;
      if (bullet.test(line)) {
        return line.replace(/^\s*[•·▪◦\-\*]\s+/u, "- ");
      }
      // numbered lists: 1)  1.  1 -
      line = line.replace(/^\s*(\d+)[\)\.-]\s+/, (_: any, n: string) => `${n}. `);
      return line;
    }).join("\n");

    // Collapse >2 blank lines to max 1
    t = t.replace(/\n{3,}/g, "\n\n");

    // Strip tracking params from URLs
    t = stripTrackingParamsInText(t);

    // Trim trailing spaces
    t = t.replace(/[ \t]+$/gm, "");

    return t.trim();
  }).join("");

  return cleaned;
}

function splitByCodeFences(text: string): Array<{ isCode: boolean; text: string }> {
  const parts: Array<{ isCode: boolean; text: string }> = [];
  const fence = /```[\s\S]*?```/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(text)) !== null) {
    const before = text.slice(lastIndex, m.index);
    if (before) parts.push({ isCode: false, text: before });
    parts.push({ isCode: true, text: m[0] });
    lastIndex = fence.lastIndex;
  }
  const after = text.slice(lastIndex);
  if (after) parts.push({ isCode: false, text: after });
  if (parts.length === 0) {
    parts.push({ isCode: false, text });
  }
  return parts;
}

function stripTrackingParamsInText(t: string): string {
  // Replace full URLs found in text while preserving surrounding punctuation.
  const urlRegex = /(https?:\/\/[^\s)\]\}]+)([)\]\}]?)/g;
  return t.replace(urlRegex, (match, url, trailer) => {
    try {
      const u = new URL(url);
      // Remove common tracking params
      const toDelete = Array.from(u.searchParams.keys()).filter(k =>
        /^utm_|^fbclid$|^gclid$|^mc_eid$|^ref$|^ref_src$|^igshid$|^si$|^spm$|^yclid$|^pk_/.test(k)
      );
      toDelete.forEach(k => u.searchParams.delete(k));
      // If query is now empty, drop '?'
      u.search = u.searchParams.toString();
      let cleaned = u.toString();
      // Keep hash as-is
      if (u.hash && !cleaned.includes(u.hash)) cleaned += u.hash;
      return cleaned + (trailer || "");
    } catch {
      return match; // not a valid URL, leave as-is
    }
  });
}
