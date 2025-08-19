// src/lib/note.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from './db';
import { createNote } from './note';
import * as classify from './classify';

// Mock dependencies
vi.mock('./db', () => ({
  db: {
    notes: {
      add: vi.fn(),
    },
  },
}));

vi.mock('./classify', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    generateTitle: vi.fn(),
    guessTopics: vi.fn(),
  };
});

describe('createNote', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.mocked(db.notes.add).mockClear();
    vi.mocked(classify.generateTitle).mockResolvedValue('Test Title');
    vi.mocked(classify.guessTopics).mockResolvedValue(['topic1', 'topic2']);
  });

  it('should extract the first YouTube URL and remove all links from the content', async () => {
    const content = `
      <p>This is a test note.</p>
      <p>Here is a regular link: <a href="https://example.com">Click me</a>.</p>
      <p>Here is the first YouTube link: https://www.youtube.com/watch?v=first111111</p>
      <p>Another link: http://google.com</p>
      <p>And a second YouTube link: https://youtu.be/second22222</p>
    `;
    
    const note = await createNote({ content });

    expect(note.sourceType).toBe('youtube');
    expect(note.sourceUrl).toBe('https://www.youtube.com/watch?v=first111111');
    
    const expectedContent = content.replace(/https?:\/\/\S+/gi, '').trim();
    expect(note.content).toBe(expectedContent);
    expect(db.notes.add).toHaveBeenCalledOnce();
  });

  it('should remove all links and have a null sourceUrl if no YouTube link is present', async () => {
    const content = `
      <p>A note with no YouTube links.</p>
      <p>Just a regular link: <a href="https://example.com">Example</a>.</p>
      <p>And another one: http://anothersite.com</p>
    `;
    
    const note = await createNote({ content });

    expect(note.sourceType).toBe('other');
    expect(note.sourceUrl).toBeNull();
    
    const expectedContent = content.replace(/https?:\/\/\S+/gi, '').trim();
    expect(note.content).toBe(expectedContent);
    expect(db.notes.add).toHaveBeenCalledOnce();
  });

  it('should handle content with only YouTube links', async () => {
    const content = 'Check this out: https://www.youtube.com/watch?v=onlytube11 and https://youtu.be/onlytube22';
    
    const note = await createNote({ content });

    expect(note.sourceType).toBe('youtube');
    expect(note.sourceUrl).toBe('https://www.youtube.com/watch?v=onlytube11');
    // The regex replaces the URLs with empty strings, leaving spaces.
    expect(note.content).toBe('Check this out:  and');
    expect(db.notes.add).toHaveBeenCalledOnce();
  });

  it('should handle content with no links', async () => {
    const content = '<p>This is some simple text content without any links.</p>';
    
    const note = await createNote({ content });

    expect(note.sourceType).toBe('other');
    expect(note.sourceUrl).toBeNull();
    expect(note.content).toBe(content);
    expect(db.notes.add).toHaveBeenCalledOnce();
  });
});