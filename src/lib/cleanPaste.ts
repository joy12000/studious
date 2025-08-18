// src/lib/cleanPaste.ts

/**
 * A list of common URL tracking parameter prefixes or exact names to be removed.
 * This makes the list easier to manage and extend.
 */
const TRACKING_PARAMS_TO_STRIP = [
  'utm_', 'fbclid', 'gclid', 'mc_eid', 'ref', 'ref_src', 'igshid', 'si', 'spm', 'yclid', 'pk_'
];

/**
 * Removes common tracking parameters from all URLs found within a block of text.
 * @param text The text to process.
 * @returns Text with cleaned URLs.
 */
function stripTrackingParamsInText(text: string): string {
  const urlRegex = /(https?:\/\/[^\s"'<>`()[\]{}]+)/g;
  
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
      return url;
    }
  });
}

/**
 * Extracts meaningful text content from an HTML string, preserving line breaks and basic structure.
 * @param html The HTML string to parse.
 * @returns A plain text representation with preserved structure.
 */
function getTextFromHTML(html: string): string {
  // Use the browser's built-in parser.
  const doc = new DOMParser().parseFromString(html, 'text/html');
  
  // Function to recursively traverse the DOM tree.
  function traverse(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    let text = '';
    const element = node as HTMLElement;

    // Add line breaks before and after block-level elements for spacing.
    const isBlock = window.getComputedStyle(element).display === 'block';
    if (isBlock) {
      text += '\n';
    }

    for (const child of Array.from(node.childNodes)) {
      text += traverse(child);
    }

    // Add another line break after block elements.
    if (isBlock) {
      text += '\n';
    }
    
    // Handle specific tags like <br> for explicit line breaks.
    if (element.tagName === 'BR') {
      text += '\n';
    }

    return text;
  }

  return traverse(doc.body);
}


/**
 * Smartly cleans up pasted text from clipboard data.
 * It handles both plain text and HTML, normalizes whitespace, and cleans URLs.
 * @param data The ClipboardData object from a paste event.
 * @returns The cleaned string.
 */
export async function cleanPaste(data: DataTransfer): Promise<string> {
  let pastedText = '';

  const html = data.getData('text/html');
  
  // Prefer HTML content if available, as it preserves structure.
  if (html) {
    pastedText = getTextFromHTML(html);
  } else {
    pastedText = data.getData('text/plain');
  }

  if (typeof pastedText !== 'string' || !pastedText) {
    return '';
  }

  let text = pastedText;

  // Normalize line endings to a single LF.
  text = text.replace(/\r\n?/g, "\n");

  // Replace smart quotes with standard quotes.
  text = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  // Remove zero-width characters and replace non-breaking spaces.
  text = text.replace(/["\u200B-\u200D\uFEFF]/g, "").replace(/\u00A0/g, " ");

  // Normalize bullet points and numbered lists.
  text = text.replace(/^\s*[•·▪◦*-]\s+/gm, "- ");
  text = text.replace(/^\s*(\d+)[).-]\s+/gm, "$1. ");

  // Collapse more than two consecutive blank lines into a single blank line.
  text = text.replace(/\n{3,}/g, "\n\n");

  // Remove tracking parameters from URLs.
  text = stripTrackingParamsInText(text);

  // Trim trailing whitespace from each line.
  text = text.replace(/[ \t]+$/gm, "");

  return text.trim();
}
