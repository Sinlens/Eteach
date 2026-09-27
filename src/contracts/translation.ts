import { z } from "zod";

import { careerIdSchema } from "./career";
import { targetLocaleSchema } from "./locale";
import { rewriteResponseSchema } from "./rewrite";
import { toneIdSchema } from "./tone";

/**
 * A stored rewrite (manual §15 `translations`, §22 `GET /api/translations`).
 *
 * The whole response is kept, not just the output text, so reopening an entry
 * restores the full result without another model call — the manual asks for
 * exactly that kind of reuse in §25.
 */
export const translationRecordSchema = z.object({
  id: z.string().trim().min(1),
  inputText: z.string().trim().min(1),
  career: careerIdSchema,
  tone: toneIdSchema,
  locale: targetLocaleSchema,
  createdAt: z.string().datetime(),
  result: rewriteResponseSchema,
});

export type TranslationRecord = z.infer<typeof translationRecordSchema>;
