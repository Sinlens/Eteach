import { describe, expect } from "vitest";

import { CAREER_IDS } from "@/contracts/career";
import { FEEDBACK_TYPES } from "@/contracts/feedback";
import { TARGET_LOCALES } from "@/contracts/locale";
import { TONE_IDS } from "@/contracts/tone";

import { insertProfile, insertTranslation, test } from "./test-support";

/**
 * The schema runs against a real PostgreSQL engine (PGlite, Postgres compiled
 * to WASM) rather than being reviewed by eye. Everything asserted here is
 * asserted by the same engine Supabase runs.
 */
describe("initial schema", () => {
  test("applies the migrations and the seed without error", async ({ db }) => {
    const { rows } = await db.query<{ count: number }>(
      "select count(*)::int as count from information_schema.tables where table_schema = 'public'",
    );

    expect(rows[0]?.count).toBeGreaterThan(0);
  });
});

// If an id is added in TypeScript and not in the seed, these fail.
describe("taxonomy parity with the TypeScript contracts", () => {
  test("seeds exactly the careers the contract defines, in order", async ({ db }) => {
    const { rows } = await db.query<{ id: string }>("select id from careers order by sort_order");

    expect(rows.map((row) => row.id)).toEqual([...CAREER_IDS]);
  });

  test("seeds exactly the tones the contract defines, in order", async ({ db }) => {
    const { rows } = await db.query<{ id: string }>("select id from tones order by sort_order");

    expect(rows.map((row) => row.id)).toEqual([...TONE_IDS]);
  });

  test("seeds exactly the target locales the contract defines", async ({ db }) => {
    const { rows } = await db.query<{ id: string }>("select id from locales order by id");

    expect(rows.map((row) => row.id)).toEqual([...TARGET_LOCALES]);
  });

  test("accepts every feedback type the contract defines and nothing else", async ({ db }) => {
    const profileId = await insertProfile(db);
    await insertTranslation(db, profileId);

    for (const feedbackType of FEEDBACK_TYPES) {
      await db.query(
        "insert into user_feedback (profile_id, translation_id, feedback_type) values ($1, 'rw_01', $2)",
        [profileId, feedbackType],
      );
    }

    await expect(
      db.query(
        "insert into user_feedback (profile_id, translation_id, feedback_type) values ($1, 'rw_01', 'amazing')",
        [profileId],
      ),
    ).rejects.toThrow();
  });
});

describe("referential integrity", () => {
  test("rejects a translation with an unknown career", async ({ db }) => {
    const profileId = await insertProfile(db);

    await expect(
      db.query(
        `insert into translations
           (id, profile_id, input_text, professional_version, career, tone, locale, result)
         values ('rw_bad', $1, 'in', 'out', 'astrology', 'professional', 'en-US', '{}'::jsonb)`,
        [profileId],
      ),
    ).rejects.toThrow();
  });

  test("keeps the whole rewrite so an entry can be reopened without a model call", async ({
    db,
  }) => {
    const profileId = await insertProfile(db);
    await insertTranslation(db, profileId);

    const { rows } = await db.query<{ phrase: string }>(
      "select result -> 'keyPhrases' -> 0 ->> 'phrase' as phrase from translations where id = 'rw_01'",
    );

    expect(rows[0]?.phrase).toBe("the next step is");
  });

  test("removes everything belonging to a profile when it is deleted", async ({ db }) => {
    const profileId = await insertProfile(db);
    await insertTranslation(db, profileId);
    await db.query(
      "insert into user_feedback (profile_id, translation_id, feedback_type) values ($1, 'rw_01', 'useful')",
      [profileId],
    );

    await db.query("delete from profiles where id = $1", [profileId]);

    const { rows } = await db.query<{ count: number }>(
      "select (select count(*) from translations) + (select count(*) from user_feedback) as count",
    );
    expect(Number(rows[0]?.count)).toBe(0);
  });

  test("allows only one profile per signed-in user", async ({ db }) => {
    const { rows } = await db.query<{ id: string }>(
      "insert into users (email) values ('someone@example.com') returning id",
    );
    const userId = rows[0]?.id;

    await db.query("insert into profiles (anonymous_key, user_id) values ('device_a', $1)", [
      userId,
    ]);

    await expect(
      db.query("insert into profiles (anonymous_key, user_id) values ('device_b', $1)", [userId]),
    ).rejects.toThrow();
  });
});

describe("saved phrases", () => {
  test("stores a phrase saved from a rewrite, which has no card behind it", async ({ db }) => {
    const profileId = await insertProfile(db);

    await db.query(
      `insert into saved_phrases (profile_id, phrase_key, phrase, meaning, career, source)
       values ($1, 'rw_the_next_step_is', 'the next step is', 'Introduces the next action.',
               'data_engineering', 'rewrite')`,
      [profileId],
    );

    const { rows } = await db.query<{ count: number }>(
      "select count(*)::int as count from saved_phrases",
    );
    expect(rows[0]?.count).toBe(1);
  });

  test("refuses to save the same phrase twice for one profile", async ({ db }) => {
    const profileId = await insertProfile(db);
    const insert = `insert into saved_phrases (profile_id, phrase_key, phrase, meaning, career, source)
                    values ($1, 'rw_align_on', 'align on', 'Asks for agreement.', 'data_engineering', 'rewrite')`;

    await db.query(insert, [profileId]);

    await expect(db.query(insert, [profileId])).rejects.toThrow();
  });

  test("lets two profiles save the same phrase independently", async ({ db }) => {
    const first = await insertProfile(db, "device_1");
    const second = await insertProfile(db, "device_2");
    const insert = `insert into saved_phrases (profile_id, phrase_key, phrase, meaning, career, source)
                    values ($1, 'rw_align_on', 'align on', 'Asks for agreement.', 'data_engineering', 'rewrite')`;

    await db.query(insert, [first]);
    await db.query(insert, [second]);

    const { rows } = await db.query<{ count: number }>(
      "select count(*)::int as count from saved_phrases",
    );
    expect(rows[0]?.count).toBe(2);
  });

  test("rejects a card-sourced phrase that points at no card", async ({ db }) => {
    const profileId = await insertProfile(db);

    await expect(
      db.query(
        `insert into saved_phrases (profile_id, phrase_key, phrase, meaning, career, source)
         values ($1, 'pc_x', 'a phrase', 'a meaning', 'data_engineering', 'phrase_card')`,
        [profileId],
      ),
    ).rejects.toThrow();
  });

  test("rejects a rewrite-sourced phrase that claims a card", async ({ db }) => {
    const profileId = await insertProfile(db);

    await expect(
      db.query(
        `insert into saved_phrases
           (profile_id, phrase_key, phrase, meaning, career, source, phrase_card_id)
         values ($1, 'rw_x', 'a phrase', 'a meaning', 'data_engineering', 'rewrite',
                 'pc_data_engineering_01')`,
        [profileId],
      ),
    ).rejects.toThrow();
  });
});

/** The taxonomies: public to read, and pointed at by a foreign key from
 * everything else, which is what makes losing a row unrecoverable. */
const REFERENCE_TABLES = [
  "careers",
  "input_languages",
  "locales",
  "phrase_cards",
  "tones",
] as const;

describe("access control", () => {
  test("enables row level security on every table in the public schema", async ({ db }) => {
    const { rows } = await db.query<{ tablename: string }>(
      `select tablename from pg_tables
       where schemaname = 'public' and rowsecurity = true
       order by tablename`,
    );

    expect(rows.map((row) => row.tablename)).toEqual([
      "careers",
      "input_languages",
      "learning_signals",
      "locales",
      "phrase_cards",
      "profiles",
      "saved_phrases",
      "tones",
      "translation_outcomes",
      "translations",
      "user_feedback",
      "users",
    ]);
  });

  test("leaves every table holding user data without a policy, which is deny-all", async ({
    db,
  }) => {
    const { rows } = await db.query<{ tablename: string }>(
      "select distinct tablename from pg_policies where schemaname = 'public' order by tablename",
    );

    // Reference data is the only thing a policy reopens. Nothing a user wrote
    // has one, so it stays reachable only through the server (§24).
    expect(rows.map((row) => row.tablename)).toEqual([...REFERENCE_TABLES]);
  });

  test("reopens the reference tables for reading only, and for no other command", async ({ db }) => {
    const { rows } = await db.query<{ tablename: string; cmd: string; roles: string }>(
      `select tablename, cmd, roles::text as roles from pg_policies
       where schemaname = 'public' order by tablename`,
    );

    expect(rows).toHaveLength(REFERENCE_TABLES.length);

    for (const row of rows) {
      expect(row.cmd).toBe("SELECT");
      expect(row.roles).toBe("{anon,authenticated}");
    }
  });
});

/**
 * The anon key ships to the browser, so `anon` is effectively the public. These
 * cases are the reason the lockdown migration exists: Supabase grants every
 * privilege on a new table in `public` to that role, which left the taxonomies
 * deletable by anyone holding a key that is public by design.
 *
 * Each rejection runs inside a savepoint because a failed statement aborts the
 * surrounding transaction, and the fixture shares one engine across cases.
 */
describe("the reference tables as seen by the public", () => {
  test("lets the anon role read the taxonomies", async ({ db }) => {
    await db.exec("set local role anon");

    const { rows } = await db.query<{ id: string }>("select id from careers order by sort_order");

    expect(rows.map((row) => row.id)).toEqual([...CAREER_IDS]);
  });

  test("refuses an insert from the anon role", async ({ db }) => {
    await db.exec("set local role anon");

    await expect(
      db.query("insert into careers (id, label, sort_order) values ('devrel', 'DevRel', 99)"),
    ).rejects.toThrow();
  });

  test("refuses a delete from the anon role on every reference table", async ({ db }) => {
    await db.exec("set local role anon");

    for (const table of REFERENCE_TABLES) {
      await db.exec("savepoint probe");
      await expect(db.query(`delete from ${table}`)).rejects.toThrow();
      await db.exec("rollback to savepoint probe");
    }
  });

  test("refuses a truncate from the anon role on every reference table", async ({ db }) => {
    await db.exec("set local role anon");

    for (const table of REFERENCE_TABLES) {
      await db.exec("savepoint probe");
      await expect(db.query(`truncate ${table}`)).rejects.toThrow();
      await db.exec("rollback to savepoint probe");
    }
  });
});
