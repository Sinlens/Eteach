import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { feedbackTypeSchema } from "@/contracts/feedback";
import { savedPhraseSchema } from "@/contracts/saved-phrase";
import { translationRecordSchema } from "@/contracts/translation";

import {
  clearHistoryCall,
  deleteProfileCall,
  ensureProfileCall,
  listHistoryCall,
  listSavedPhrasesCall,
  recordFeedbackCall,
  recordTranslationCall,
  removeSavedPhraseCall,
  savePhraseCall,
} from "@/server/db/rpc";
import { toSavedPhrase, toTranslationRecord } from "@/server/db/rows";
import { callRpc } from "@/server/db/supabase";

/**
 * The server boundary.
 *
 * The browser never reaches the database: it calls these, they resolve the
 * device's profile and forward to a database function. The service role key
 * stays on this side (§24).
 *
 * Input is validated here too — an anonymous key arrives from browser storage,
 * which is editable by anyone sitting at the machine.
 */
const anonymousKeySchema = z.string().uuid();

const HISTORY_LIMIT_CEILING = 50;

async function resolveProfileId(anonymousKey: string): Promise<string> {
  return callRpc<string>(ensureProfileCall(anonymousKey));
}

function parseRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

export const listHistoryFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        anonymousKey: anonymousKeySchema,
        limit: z.number().int().positive().max(HISTORY_LIMIT_CEILING),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const profileId = await resolveProfileId(data.anonymousKey);
    const rows = await callRpc<unknown>(listHistoryCall(profileId, data.limit));

    return parseRows(rows).map(toTranslationRecord);
  });

export const recordTranslationFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ anonymousKey: anonymousKeySchema, record: translationRecordSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const profileId = await resolveProfileId(data.anonymousKey);
    const { record } = data;

    await callRpc<unknown>(
      recordTranslationCall({
        profileId,
        translationId: record.id,
        inputText: record.inputText,
        career: record.career,
        tone: record.tone,
        locale: record.locale,
        result: record.result,
      }),
    );
  });

export const clearHistoryFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ anonymousKey: anonymousKeySchema }).parse(input))
  .handler(async ({ data }) => {
    const profileId = await resolveProfileId(data.anonymousKey);
    await callRpc<unknown>(clearHistoryCall(profileId));
  });

export const listSavedPhrasesFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ anonymousKey: anonymousKeySchema }).parse(input))
  .handler(async ({ data }) => {
    const profileId = await resolveProfileId(data.anonymousKey);
    const rows = await callRpc<unknown>(listSavedPhrasesCall(profileId));

    return parseRows(rows).map(toSavedPhrase);
  });

export const savePhraseFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ anonymousKey: anonymousKeySchema, phrase: savedPhraseSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const profileId = await resolveProfileId(data.anonymousKey);
    const { phrase } = data;

    await callRpc<unknown>(
      savePhraseCall({
        profileId,
        phraseKey: phrase.id,
        phrase: phrase.phrase,
        meaning: phrase.meaning,
        career: phrase.career,
        source: phrase.source,
        example: phrase.example,
        category: phrase.category,
        difficulty: phrase.difficulty,
        phraseCardId: phrase.source === "phrase_card" ? phrase.id : null,
      }),
    );
  });

export const removeSavedPhraseFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ anonymousKey: anonymousKeySchema, id: z.string().trim().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const profileId = await resolveProfileId(data.anonymousKey);
    await callRpc<unknown>(removeSavedPhraseCall(profileId, data.id));
  });

/**
 * The delete path.
 *
 * `ensure_profile` runs first even though the row is about to go: it resolves
 * the key to exactly one profile id, and creating one that is deleted in the
 * next statement costs nothing. Working from the key alone would mean a second
 * place that knows how a key maps to a profile.
 */
export const deleteProfileFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ anonymousKey: anonymousKeySchema }).parse(input))
  .handler(async ({ data }) => {
    const profileId = await resolveProfileId(data.anonymousKey);
    await callRpc<unknown>(deleteProfileCall(profileId));
  });

export const submitFeedbackFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        anonymousKey: anonymousKeySchema,
        translationId: z.string().trim().min(1),
        feedback: feedbackTypeSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const profileId = await resolveProfileId(data.anonymousKey);

    await callRpc<unknown>(
      recordFeedbackCall({
        profileId,
        translationId: data.translationId,
        feedback: data.feedback,
      }),
    );
  });
