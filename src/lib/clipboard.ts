export type ClipResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'no_api' | 'denied' | 'empty' | 'unknown'; debug?: string };

export async function readClipboardText(): Promise<ClipResult> {
  try {
    const nav: any = navigator as any;
    if (!nav?.clipboard || typeof nav.clipboard.readText !== 'function') {
      return { ok: false, reason: 'no_api' };
    }
    const text = await nav.clipboard.readText();
    if (typeof text !== 'string') {
      return { ok: false, reason: 'empty' };
    }
    const trimmed = text.replace(/\r\n?/g, '\n');
    if (!trimmed.trim()) {
      return { ok: false, reason: 'empty' };
    }
    return { ok: true, text: text };
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    // Heuristics for common cases
    if (/denied|permission/i.test(msg)) return { ok: false, reason: 'denied', debug: msg };
    if (/secure|insecure|https|available/i.test(msg)) return { ok: false, reason: 'no_api', debug: msg };
    return { ok: false, reason: 'unknown', debug: msg };
  }
}
