// src/lib/safeCreateNote.ts
import { db } from "./db";
import { generateTitle, guessTopics } from "./classify";

export async function safeCreateNoteFromText(raw: string) {
  const text = String(raw || "").trim();
  if (!text) throw new Error("빈 텍스트입니다.");

  const id =
    (globalThis.crypto as any)?.randomUUID?.() ||
    `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const title = generateTitle(text);
  let topics = await guessTopics(text);

  // Ensure topics is always an array
  if (!Array.isArray(topics)) {
    console.warn("guessTopics did not return an array, defaulting to ['Other']");
    topics = ['Other'];
  }

  const createdAt = Date.now();

  await db.notes.put({
    id,
    content: text,
    title,
    topics,
    favorite: false,
    createdAt,
    sourceType: "capture",
    todo: [],
    labels: [],
    highlights: [],
  } as any);

  return id;
}

export { safeCreateNoteFromText as safeCreateNote };
