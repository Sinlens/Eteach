import { z } from "zod";

import { careerIdSchema } from "./career";
import { phraseCategorySchema, phraseDifficultySchema } from "./phrase-card";

/**
 * A phrase in the user's personal library (manual §5.5, §15 `saved_phrases`).
 *
 * §15 models this as a foreign key to `phrase_cards`, but the product also lets
 * users save a key phrase produced by a rewrite, which has no card behind it.
 * `source` carries that distinction, and the card-only fields are nullable.
 */
export const SAVED_PHRASE_SOURCES = ["rewrite", "phrase_card"] as const;

export type SavedPhraseSource = (typeof SAVED_PHRASE_SOURCES)[number];

export const savedPhraseSourceSchema = z.enum(SAVED_PHRASE_SOURCES);

export const SAVED_PHRASE_SOURCE_LABELS: Record<SavedPhraseSource, string> = {
  rewrite: "From a rewrite",
  phrase_card: "From a card",
};

export const savedPhraseSchema = z.object({
  id: z.string().trim().min(1),
  phrase: z.string().trim().min(1),
  meaning: z.string().trim().min(1),
  example: z.string().trim().min(1).nullable(),
  career: careerIdSchema,
  category: phraseCategorySchema.nullable(),
  difficulty: phraseDifficultySchema.nullable(),
  source: savedPhraseSourceSchema,
  savedAt: z.string().datetime(),
});

export type SavedPhrase = z.infer<typeof savedPhraseSchema>;

/**
 * Deterministic id for a phrase saved from a rewrite, so saving the same
 * wording twice is idempotent rather than duplicating the entry.
 */
export function rewritePhraseId(phrase: string): string {
  const slug = phrase
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `rw_${slug}`;
}
