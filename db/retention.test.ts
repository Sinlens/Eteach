import type { PGlite } from "@electric-sql/pglite";
import { describe, expect } from "vitest";

import { buildResult, insertProfile, test } from "./test-support";

/**
 * The retention window.
 *
 * `20260926120000_initial_schema.sql` states the obligation this covers:
 *
 *   > Retention: this stores what people actually write, which can include
 *   > employer names, project detail and recruiter names. A retention window
 *   > and a delete path must exist before real users are onboarded.
 *
 * The window anonymises rather than deletes. What is sensitive is the wording
 * somebody typed, not the fact that a rewrite happened on a Tuesday — and
 * `translation_outcomes` exists to answer whether the product works at all
 * (§30, §31), which deleting the parent row would take with it.
 *
 * The consequence to keep in view: `translationRecordSchema` requires
 * `inputText` to be a non-empty string and `result` to be a whole
 * `RewriteResponse`, and `toTranslationRecord` parses every row rather than
 * casting it. An emptied row can therefore never reach that parser, so
 * `list_history` has to stop returning them.
 */
const WINDOW_DAYS = 90;

async function insertAgedTranslation(
  db: PGlite,
  profileId: string,
  id: string,
  ageDays: number,
  inputText = "Hi Sarah, about the offer you mentioned on Tuesday.",
): Promise<void> {
  await db.query(
    `insert into translations
       (id, profile_id, input_text, professional_version, career, tone, locale, result, created_at)
     values ($1, $2, $3, $4, 'data_engineering', 'professional', 'en-US', $5,
             now() - make_interval(days => $6::int))`,
    [
      id,
      profileId,
      inputText,
      "Thank you for mentioning the offer on Tuesday.",
      buildResult(id, "Thank you."),
      ageDays,
    ],
  );
}

async function anonymise(db: PGlite, days = WINDOW_DAYS): Promise<number> {
  const { rows } = await db.query<{ anonymize_expired_content: number }>(
    "select maintenance.anonymize_expired_content($1) as anonymize_expired_content",
    [days],
  );

  return rows[0]?.anonymize_expired_content ?? -1;
}

describe("the retention window", () => {
  test("empties what the person wrote once the window has passed", async ({ db }) => {
    const profileId = await insertProfile(db);
    await insertAgedTranslation(db, profileId, "rw_old", WINDOW_DAYS + 1);

    await anonymise(db);

    const { rows } = await db.query<{
      input_text: string;
      professional_version: string;
      result: unknown;
      anonymized_at: string | null;
    }>("select input_text, professional_version, result, anonymized_at from translations");

    expect(rows[0]?.input_text).toBe("");
    expect(rows[0]?.professional_version).toBe("");
    expect(rows[0]?.result).toEqual({});
    expect(rows[0]?.anonymized_at).not.toBeNull();
  });

  test("leaves a translation inside the window alone", async ({ db }) => {
    const profileId = await insertProfile(db);
    await insertAgedTranslation(db, profileId, "rw_recent", WINDOW_DAYS - 1);

    await anonymise(db);

    const { rows } = await db.query<{ input_text: string; anonymized_at: string | null }>(
      "select input_text, anonymized_at from translations",
    );

    expect(rows[0]?.input_text).toBe("Hi Sarah, about the offer you mentioned on Tuesday.");
    expect(rows[0]?.anonymized_at).toBeNull();
  });

  // The whole reason for anonymising instead of deleting: these columns answer
  // whether the wording was good enough to send, and they carry nobody's words.
  test("keeps the columns the product is measured by", async ({ db }) => {
    const profileId = await insertProfile(db);
    await insertAgedTranslation(db, profileId, "rw_old", WINDOW_DAYS + 1);

    await anonymise(db);

    const { rows } = await db.query<{
      career: string;
      tone: string;
      locale: string;
      created_at: string;
    }>("select career, tone, locale, created_at from translations");

    expect(rows[0]?.career).toBe("data_engineering");
    expect(rows[0]?.tone).toBe("professional");
    expect(rows[0]?.locale).toBe("en-US");
    expect(rows[0]?.created_at).not.toBeNull();
  });

  test("clears the version accepted against an anonymised translation", async ({ db }) => {
    const profileId = await insertProfile(db);
    await insertAgedTranslation(db, profileId, "rw_old", WINDOW_DAYS + 1);
    await db.query(
      `insert into translation_outcomes (profile_id, translation_id, action, accepted_version)
       values ($1, 'rw_old', 'edited', 'What I actually sent to the recruiter.')`,
      [profileId],
    );

    await anonymise(db);

    const { rows } = await db.query<{ accepted_version: string | null; action: string }>(
      "select accepted_version, action from translation_outcomes",
    );

    expect(rows[0]?.accepted_version).toBeNull();
    // The action is the signal; it stays.
    expect(rows[0]?.action).toBe("edited");
  });

  test("clears the expression held on an old learning signal", async ({ db }) => {
    const profileId = await insertProfile(db);
    await db.query(
      `insert into learning_signals (profile_id, skill, issue, expression, confidence, created_at)
       values ($1, 'tone', 'too_direct', 'send me that asap', 0.8,
               now() - make_interval(days => $2::int))`,
      [profileId, WINDOW_DAYS + 1],
    );

    await anonymise(db);

    const { rows } = await db.query<{ expression: string; skill: string }>(
      "select expression, skill from learning_signals",
    );

    expect(rows[0]?.expression).toBe("");
    expect(rows[0]?.skill).toBe("tone");
  });

  // Saved phrases are a deliberate keep, not a by-product. Emptying them would
  // wipe the library the person built on purpose, so they are out of the time
  // window and belong to the on-demand delete path instead.
  test("does not touch saved phrases", async ({ db }) => {
    const profileId = await insertProfile(db);
    await db.query(
      `insert into saved_phrases
         (profile_id, phrase_key, phrase, meaning, career, source, saved_at)
       values ($1, 'rw_the_next_step_is', 'the next step is', 'Introduces the next action.',
               'data_engineering', 'rewrite', now() - make_interval(days => $2::int))`,
      [profileId, WINDOW_DAYS + 10],
    );

    await anonymise(db);

    const { rows } = await db.query<{ phrase: string }>("select phrase from saved_phrases");

    expect(rows[0]?.phrase).toBe("the next step is");
  });

  test("runs twice without doing the work twice", async ({ db }) => {
    const profileId = await insertProfile(db);
    await insertAgedTranslation(db, profileId, "rw_old", WINDOW_DAYS + 1);

    expect(await anonymise(db)).toBe(1);

    // The driver hands back `Date` objects, so this compares the instant rather
    // than the instance.
    const stampedAt = async (): Promise<number> => {
      const { rows } = await db.query<{ anonymized_at: Date }>(
        "select anonymized_at from translations",
      );

      return new Date(String(rows[0]?.anonymized_at)).getTime();
    };

    const first = await stampedAt();

    expect(await anonymise(db)).toBe(0);
    expect(await stampedAt()).toBe(first);
  });

  /**
   * The case that keeps the application alive.
   *
   * `toTranslationRecord` parses every row `list_history` returns, and the
   * contract requires a non-empty `inputText` and a whole `RewriteResponse`.
   * One anonymised row reaching it would not degrade the history, it would
   * throw and take the entire endpoint with it.
   */
  test("stops returning anonymised rows from list_history", async ({ db }) => {
    const profileId = await insertProfile(db);
    await insertAgedTranslation(db, profileId, "rw_old", WINDOW_DAYS + 1);
    await insertAgedTranslation(db, profileId, "rw_recent", 1, "ship it today please");

    await anonymise(db);

    const { rows } = await db.query<{ id: string; input_text: string }>(
      "select id, input_text from list_history($1, 50)",
      [profileId],
    );

    expect(rows.map((row) => row.id)).toEqual(["rw_recent"]);
    expect(rows.every((row) => row.input_text.length > 0)).toBe(true);
  });

  test("reports how many translations it anonymised", async ({ db }) => {
    const profileId = await insertProfile(db);
    await insertAgedTranslation(db, profileId, "rw_a", WINDOW_DAYS + 1);
    await insertAgedTranslation(db, profileId, "rw_b", WINDOW_DAYS + 2);
    await insertAgedTranslation(db, profileId, "rw_c", 3);

    expect(await anonymise(db)).toBe(2);
  });
});

describe("the retention job is not part of the client API", () => {
  // `db/rpc-parity.test.ts` asserts that `public` exposes exactly the functions
  // the client knows about. Maintenance lives outside it, which also keeps it
  // off PostgREST: only `public` and `graphql_public` are exposed.
  test("lives outside the schema PostgREST exposes", async ({ db }) => {
    const { rows } = await db.query<{ nspname: string }>(
      `select n.nspname
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where p.proname = 'anonymize_expired_content'`,
    );

    expect(rows.map((row) => row.nspname)).toEqual(["maintenance"]);
  });
});
