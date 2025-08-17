/**
 * A list of common URL tracking parameter prefixes or exact names to be removed.
 * This makes the list easier to manage and extend.
 */
const TRACKING_PARAMS_TO_STRIP = [
  'utm_', 'fbclid', 'gclid', 'mc_eid', 'ref', 'ref_src', 'igshid', 'si', 'spm', 'yclid', 'pk_'
];

/**
 * Splits a text into segments, separating out code blocks enclosed in triple backticks.
 * @param text The source text.
 * @returns An array of segments, marked as code or regular text.
 */
function splitByCodeFences(text: string): Array<{ isCode: boolean; text: string }> {
  const parts: Array<{ isCode: boolean; text: string }> = [];
  // Use a non-greedy match for content within fences.
  const fenceRegex = /```[\s\S]*?```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before) parts.push({ isCode: false, text: before });
    parts.push({ isCode: true, text: match[0] });
    lastIndex = fenceRegex.lastIndex;
  }

  const after = text.slice(lastIndex);
  if (after) parts.push({ isCode: false, text: after });

  // If no fences were found, the whole text is a single, non-code segment.
  if (parts.length === 0) {
    parts.push({ isCode: false, text });
  }
  return parts;
}

/**
 * Removes common tracking parameters from all URLs found within a block of text.
 * @param text The text to process.
 * @returns Text with cleaned URLs.
 */
function stripTrackingParamsInText(text: string): string {
  // A more robust regex to find URLs, handling various trailing characters.
  const urlRegex = /(https?:\/\/[^\s"'<>`()\[\]{}]+)/g;
  
  return text.replace(urlRegex, (url) => {
    try {
      const urlObject = new URL(url);
      const paramsToDelete: string[] = [];

      for (const key of urlObject.searchParams.keys()) {
        if (TRACKING_PARAMS_TO_STRIP.some(param => key.startsWith(param))) {
          paramsToDelete.push(key);
        }
      }

      paramsToDelete.forEach(key => urlObject.searchParams.delete(key));
      return urlObject.toString();
    } catch {
      // If URL parsing fails, return the original string to avoid breaking things.
      return url;
    }
  });
}

/**
 * Removes all URLs and citation-like patterns (e.g., [1] http://...) from the text.
 * @param text The text to process.
 * @returns Text with links removed.
 */
function removeAllLinks(text: string): string {
  // Regex to find [number] followed by an optional space and a URL.
  const citationRegex = /[[]\d+]\]\s*https?:\/\/[^\s]+/g;
  text = text.replace(citationRegex, '');

  // Regex to find any remaining URLs.
  const urlRegex = /https?:\/\/[^\s]+/g;
  text = text.replace(urlRegex, '');

  return text;
}

/**
 * Smartly cleans up pasted text while preserving code fences.
 * It normalizes lists, removes tracking parameters from URLs, and cleans up whitespace.
 * @param raw The raw input, expected to be a string.
 * @returns The cleaned string.
 */
export function cleanPaste(raw?: unknown): string {
  if (typeof raw !== 'string' || !raw) {
    return '';
  }

  const segments = splitByCodeFences(raw);

  const cleanedSegments = segments.map(segment => {
    if (segment.isCode) {
      return segment.text; // Leave code blocks untouched.
    }

    let text = segment.text;

    // GEMINI: 모든 링크와 인용 스타일 링크 제거
    text = removeAllLinks(text);

    // Normalize line endings to a single LF.
    text = text.replace(/\r\n?/g, "\n");

    // Replace smart quotes with standard quotes.
    text = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

    // Remove zero-width characters and replace non-breaking spaces.
    text = text.replace(/["\u200B-\u200D\uFEFF]/g, "").replace(/\u00A0/g, " ");

    // Normalize bullet points and numbered lists using multiline regex for efficiency.
    text = text.replace(/^\s*[•·▪◦*-]\s+/gm, "- ");
    text = text.replace(/^\s*(\d+)[\).-]\s+/gm, "$1. ");

    // Collapse more than two consecutive blank lines into a single blank line.
    text = text.replace(/\n{3,}/g, "\n\n");

    // Remove tracking parameters from URLs within the text.
    text = stripTrackingParamsInText(text);

    // Trim trailing whitespace from each line.
    text = text.replace(/[ \t]+$/gm, "");

    return text.trim();
  });

  return cleanedSegments.join("");
}
