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
import { ensureDeviceKey, resetDeviceKey } from "@/server/identity";

/**
 * The server boundary.
 *
 * The browser never reaches the database: it calls these, they resolve the
 * device's profile and forward to a database function. The service role key
 * stays on this side (§24).
 *
 * Nothing here takes an identity. It used to arrive in the payload, where a
 * schema could check the shape of a key and never whether the caller owned it —
 * a caller said who it was and was believed. The key now comes from a cookie
 * this side sets, so these signatures carry only what the caller is actually
 * entitled to decide.
 */
const HISTORY_LIMIT_CEILING = 50;

async function resolveProfileId(): Promise<string> {
  return callRpc<string>(ensureProfileCall(ensureDeviceKey()));
}

function parseRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

export const listHistoryFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ limit: z.number().int().positive().max(HISTORY_LIMIT_CEILING) }).parse(input),
  )
  .handler(async ({ data }) => {
    const profileId = await resolveProfileId();
    const rows = await callRpc<unknown>(listHistoryCall(profileId, data.limit));

    return parseRows(rows).map(toTranslationRecord);
  });

export const recordTranslationFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ record: translationRecordSchema }).parse(input))
  .handler(async ({ data }) => {
    const profileId = await resolveProfileId();
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

export const clearHistoryFn = createServerFn({ method: "POST" }).handler(async () => {
  const profileId = await resolveProfileId();
  await callRpc<unknown>(clearHistoryCall(profileId));
});

export const listSavedPhrasesFn = createServerFn({ method: "POST" }).handler(async () => {
  const profileId = await resolveProfileId();
  const rows = await callRpc<unknown>(listSavedPhrasesCall(profileId));

  return parseRows(rows).map(toSavedPhrase);
});

export const savePhraseFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ phrase: savedPhraseSchema }).parse(input))
  .handler(async ({ data }) => {
    const profileId = await resolveProfileId();
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
  .validator((input: unknown) => z.object({ id: z.string().trim().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const profileId = await resolveProfileId();
    await callRpc<unknown>(removeSavedPhraseCall(profileId, data.id));
  });

/**
 * The delete path.
 *
 * `ensure_profile` runs first even though the row is about to go: it resolves
 * the key to exactly one profile id, and creating one that is deleted in the
 * next statement costs nothing. Working from the key alone would mean a second
 * place that knows how a key maps to a profile.
 *
 * The cookie is rotated here rather than in the browser, because the key now
 * lives somewhere the browser cannot reach. Leaving it in place would leave the
 * next request rebuilding a profile against the key that was just emptied.
 */
export const deleteProfileFn = createServerFn({ method: "POST" }).handler(async () => {
  const profileId = await resolveProfileId();
  await callRpc<unknown>(deleteProfileCall(profileId));
  resetDeviceKey();
});

export const submitFeedbackFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        translationId: z.string().trim().min(1),
        feedback: feedbackTypeSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const profileId = await resolveProfileId();

    await callRpc<unknown>(
      recordFeedbackCall({
        profileId,
        translationId: data.translationId,
        feedback: data.feedback,
      }),
    );
  });
