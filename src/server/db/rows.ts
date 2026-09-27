import { savedPhraseSchema, type SavedPhrase } from "@/contracts/saved-phrase";
import { translationRecordSchema, type TranslationRecord } from "@/contracts/translation";

/**
 * Database rows into contract objects.
 *
 * Everything is parsed rather than cast: a column that was renamed, dropped or
 * changed type fails here, on the server, instead of rendering as `undefined`
 * somewhere in the UI. This is the same rule the rewrite pipeline follows — no
 * unvalidated payload reaches the frontend.
 */

/** Postgres returns timestamps with an offset; the contracts want ISO-Z. */
function toIsoTimestamp(value: unknown): string {
  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error(`expected a timestamp, received ${JSON.stringify(value)}`);
  }

  return date.toISOString();
}

export function toTranslationRecord(row: Record<string, unknown>): TranslationRecord {
  return translationRecordSchema.parse({
    id: row["id"],
    inputText: row["input_text"],
    career: row["career"],
    tone: row["tone"],
    locale: row["locale"],
    createdAt: toIsoTimestamp(row["created_at"]),
    result: row["result"],
  });
}

export function toSavedPhrase(row: Record<string, unknown>): SavedPhrase {
  return savedPhraseSchema.parse({
    // The contract's id is the stable phrase key, not the storage row id.
    id: row["phrase_key"],
    phrase: row["phrase"],
    meaning: row["meaning"],
    example: row["example"],
    career: row["career"],
    category: row["category"],
    difficulty: row["difficulty"],
    source: row["source"],
    savedAt: toIsoTimestamp(row["saved_at"]),
  });
}
