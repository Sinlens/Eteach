import { describe, expect } from "vitest";

import { toSavedPhrase, toTranslationRecord } from "@/server/db/rows";

import { buildResult, ensureProfile, test } from "./test-support";

/**
 * The mappers run against rows the database actually produced, so a renamed or
 * retyped column fails here rather than surfacing as `undefined` in the UI.
 */
describe("toTranslationRecord", () => {
  test("maps a row returned by list_history", async ({ db }) => {
    const profileId = await ensureProfile(db);
    await db.query(
      "select record_translation($1, 'rw_01', $2, 'data_engineering', 'professional', 'en-US', $3)",
      [profileId, "I already finished the pipeline.", buildResult("rw_01", "I've finished it.")],
    );

    const { rows } = await db.query<Record<string, unknown>>("select * from list_history($1, 5)", [
      profileId,
    ]);
    const record = toTranslationRecord(rows[0] ?? {});

    expect(record.id).toBe("rw_01");
    expect(record.inputText).toBe("I already finished the pipeline.");
    expect(record.career).toBe("data_engineering");
    expect(record.tone).toBe("professional");
    expect(record.locale).toBe("en-US");
    expect(record.result.professionalVersion).toBe("I've finished it.");
    expect(record.createdAt).toMatch(/Z$/);
  });

  test("rejects a row missing a column the contract requires", async ({ db }) => {
    const profileId = await ensureProfile(db);
    await db.query(
      "select record_translation($1, 'rw_01', $2, 'data_engineering', 'professional', 'en-US', $3)",
      [profileId, "input", buildResult("rw_01", "A version.")],
    );

    const { rows } = await db.query<Record<string, unknown>>(
      "select id, career, tone, locale, created_at, result from translations",
    );

    expect(() => toTranslationRecord(rows[0] ?? {})).toThrow();
  });
});

describe("toSavedPhrase", () => {
  test("maps a rewrite-sourced row, whose card fields are null", async ({ db }) => {
    const profileId = await ensureProfile(db);
    await db.query(
      `select save_phrase($1, 'rw_the_next_step_is', 'the next step is',
         'Introduces the next action.', 'data_engineering', 'rewrite', null, null, null, null)`,
      [profileId],
    );

    const { rows } = await db.query<Record<string, unknown>>(
      "select * from list_saved_phrases($1)",
      [profileId],
    );
    const phrase = toSavedPhrase(rows[0] ?? {});

    expect(phrase.id).toBe("rw_the_next_step_is");
    expect(phrase.source).toBe("rewrite");
    expect(phrase.example).toBeNull();
    expect(phrase.category).toBeNull();
    expect(phrase.savedAt).toMatch(/Z$/);
  });

  test("maps a card-sourced row with its category and difficulty", async ({ db }) => {
    const profileId = await ensureProfile(db);
    await db.query(
      `select save_phrase($1, 'pc_data_science_01', 'I''d be happy to walk you through this',
         'Offers to explain your work.', 'data_science', 'phrase_card', 'An example.',
         'technical_explanations', 'intermediate', 'pc_data_science_01')`,
      [profileId],
    );

    const { rows } = await db.query<Record<string, unknown>>(
      "select * from list_saved_phrases($1)",
      [profileId],
    );
    const phrase = toSavedPhrase(rows[0] ?? {});

    expect(phrase.category).toBe("technical_explanations");
    expect(phrase.difficulty).toBe("intermediate");
    expect(phrase.example).toBe("An example.");
  });
});
