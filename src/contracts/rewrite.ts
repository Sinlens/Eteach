import { z } from "zod";

import { careerIdSchema } from "./career";
import { targetLocaleSchema } from "./locale";
import { toneIdSchema } from "./tone";

/**
 * The rewrite contract (manual §13, §23, §30).
 *
 * This is the single source of truth for the shape that crosses the frontend
 * boundary. Phase 2 reuses these schemas server-side; Phase 3 makes n8n produce
 * output that satisfies `rewriteResponseSchema`.
 */

/** Manual §24/§30: input length must be capped. The UI counter reads from here. */
export const MAX_INPUT_LENGTH = 1_000;

export const rewriteRequestSchema = z.object({
  text: z.string().trim().min(1, "Write something to rewrite.").max(MAX_INPUT_LENGTH),
  career: careerIdSchema,
  tone: toneIdSchema,
  locale: targetLocaleSchema,
});

export type RewriteRequest = z.infer<typeof rewriteRequestSchema>;

export const keyPhraseSchema = z.object({
  phrase: z.string().trim().min(1),
  meaning: z.string().trim().min(1),
});

export type KeyPhrase = z.infer<typeof keyPhraseSchema>;

export const vocabularyItemSchema = z.object({
  term: z.string().trim().min(1),
  definition: z.string().trim().min(1),
});

export type VocabularyItem = z.infer<typeof vocabularyItemSchema>;

export const rewriteResponseSchema = z.object({
  /**
   * Not in the manual's §13/§30 schema, but required by it: Workflow 4 (§11)
   * and `POST /api/feedback` (§22) both key feedback on a translation id. The
   * frontend cannot send feedback for a rewrite it cannot name.
   */
  id: z.string().trim().min(1),
  professionalVersion: z.string().trim().min(1),
  alternativeVersion: z.string().trim().min(1),
  explanation: z.string().trim().min(1),
  keyPhrases: z.array(keyPhraseSchema),
  /**
   * Optional on the wire (manual §30), always an array once parsed, so the UI
   * never has to null-check it.
   */
  vocabulary: z.array(vocabularyItemSchema).default([]),
});

/** Parsed shape the UI consumes — `vocabulary` is always present. */
export type RewriteResponse = z.infer<typeof rewriteResponseSchema>;

/** Wire shape a producer may send — `vocabulary` may be omitted. */
export type RewriteResponsePayload = z.input<typeof rewriteResponseSchema>;
