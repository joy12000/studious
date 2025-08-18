// src/lib/contentProcessor.ts

/**
 * Processes HTML content before saving it to the database.
 * It finds the first YouTube link, removes all other hyperlinks (while keeping their text),
 * and ensures the final HTML is clean.
 *
 * @param html The raw HTML content from the editor.
 * @returns Processed HTML string ready for saving.
 */
export function processContentForSaving(html: string): string {
  if (!html) {
    return "";
  }

  // Use the browser's DOM parser to safely manipulate the HTML
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;

  const allLinks = Array.from(body.querySelectorAll('a'));
  let firstYoutubeLink: HTMLAnchorElement | null = null;

  // Find the first YouTube link
  for (const link of allLinks) {
    if (link.href.includes('youtube.com') || link.href.includes('youtu.be')) {
      firstYoutubeLink = link;
      break;
    }
  }

  // Remove all links except the first YouTube link
  allLinks.forEach(link => {
    if (link !== firstYoutubeLink) {
      // Replace the link with its text content, so the text is not lost
      const text = doc.createTextNode(link.textContent || '');
      link.parentNode?.replaceChild(text, link);
    }
  });

  // Return the processed HTML content
  return body.innerHTML;
}
