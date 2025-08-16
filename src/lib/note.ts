// src/lib/note.ts
import { db } from "./db";
import { generateTitle, guessTopics } from "./classify";
import { Note, SourceType } from "./types";

export interface CreateNotePayload {
  content: string;
  title?: string;
  sourceUrl?: string | null;
  sourceType?: SourceType;
}

/**
 * Creates a new note, generates metadata, and saves it to the database.
 * @param payload The data for the new note.
 * @returns The newly created Note object.
 */
export async function createNote(payload: CreateNotePayload): Promise<Note> {
  const { content, title: titleFromUser, sourceUrl, sourceType: typeFromUser } = payload;

  if (!content || !content.trim()) {
    throw new Error("Content cannot be empty.");
  }

  const finalSourceUrl = sourceUrl ? String(sourceUrl).trim() : null;
  let finalSourceType: SourceType = typeFromUser || 'other';
  if (!typeFromUser && finalSourceUrl) {
    finalSourceType = finalSourceUrl.includes('youtube.com') || finalSourceUrl.includes('youtu.be') ? 'youtube' : 'web';
  }

  const id = crypto.randomUUID();
  const title = (titleFromUser || await generateTitle(content)).trim();
  const topics = await guessTopics(content);
  const now = new Date().toISOString();

  const newNote: Note = {
    id,
    title,
    content,
    sourceUrl: finalSourceUrl,
    sourceType: finalSourceType,
    createdAt: now,
    topics,
    labels: [],
    highlights: [],
    todo: [],
    favorite: false,
  };

  await db.notes.add(newNote);
  return newNote;
}