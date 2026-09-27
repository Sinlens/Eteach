import { describe, expect } from "vitest";

import { buildResult, insertProfile, test } from "./test-support";

/**
 * The delete path.
 *
 * `20260926120000_initial_schema.sql` asked for two things before real users
 * arrive — a retention window, and this. The window is time-based and automatic;
 * this is somebody deciding, now, that they want none of it kept.
 *
 * There is almost nothing to implement. Every child table references `profiles`
 * with `on delete cascade`, so removing the profile row removes the person's
 * entire footprint in one statement, atomically. The value of the tests below
 * is not that the delete works — it is that the cascade stays complete. A table
 * added later without that clause would leave rows behind and nothing would
 * say so.
 */
async function seedEverything(db: Parameters<typeof insertProfile>[0], profileId: string) {
  await db.query(
    `insert into translations
       (id, profile_id, input_text, professional_version, career, tone, locale, result)
     values ('rw_01', $1, 'hey can u check this', 'Could you review this?',
             'data_engineering', 'professional', 'en-US', $2)`,
    [profileId, buildResult("rw_01", "Could you review this?")],
  );

  await db.query(
    `insert into saved_phrases (profile_id, phrase_key, phrase, meaning, career, source)
     values ($1, 'rw_the_next_step_is', 'the next step is', 'Introduces the next action.',
             'data_engineering', 'rewrite')`,
    [profileId],
  );

  await db.query(
    `insert into user_feedback (profile_id, translation_id, feedback_type)
     values ($1, 'rw_01', 'useful')`,
    [profileId],
  );

  await db.query(
    `insert into learning_signals (profile_id, skill, issue, expression, confidence)
     values ($1, 'tone', 'too_direct', 'send me that asap', 0.8)`,
    [profileId],
  );

  await db.query(
    `insert into translation_outcomes (profile_id, translation_id, action, accepted_version)
     values ($1, 'rw_01', 'copied', 'Could you review this?')`,
    [profileId],
  );

  // Holds an email address, so it is squarely personal.
  await db.query(
    `insert into pending_sign_ins (profile_id, email, expires_at)
     values ($1, 'someone@example.com', now() + interval '15 minutes')`,
    [profileId],
  );
}

const CHILD_TABLES = [
  "translations",
  "saved_phrases",
  "user_feedback",
  "learning_signals",
  "translation_outcomes",
  "pending_sign_ins",
] as const;

describe("deleting everything a person stored", () => {
  test("leaves nothing behind in any table", async ({ db }) => {
    const profileId = await insertProfile(db);
    await seedEverything(db, profileId);

    await db.query("select delete_profile($1)", [profileId]);

    for (const table of CHILD_TABLES) {
      const { rows } = await db.query<{ count: number }>(
        `select count(*)::int as count from ${table}`,
      );

      expect(rows[0]?.count, `${table} still holds rows`).toBe(0);
    }

    const { rows } = await db.query<{ count: number }>(
      "select count(*)::int as count from profiles",
    );

    expect(rows[0]?.count).toBe(0);
  });

  test("touches nobody else's rows", async ({ db }) => {
    const mine = await insertProfile(db, "device_mine");
    const theirs = await insertProfile(db, "device_theirs");
    await seedEverything(db, mine);
    await db.query(
      `insert into saved_phrases (profile_id, phrase_key, phrase, meaning, career, source)
       values ($1, 'rw_kept', 'kept', 'Still here.', 'data_science', 'rewrite')`,
      [theirs],
    );

    await db.query("select delete_profile($1)", [mine]);

    const { rows } = await db.query<{ phrase_key: string }>("select phrase_key from saved_phrases");

    expect(rows.map((row) => row.phrase_key)).toEqual(["rw_kept"]);
  });

  test("says nothing and fails at nothing when the profile is already gone", async ({ db }) => {
    await expect(
      db.query("select delete_profile('00000000-0000-4000-8000-000000000000'::uuid)"),
    ).resolves.toBeDefined();
  });

  // The reference data every profile points at is shared, not personal.
  test("leaves the taxonomies alone", async ({ db }) => {
    const profileId = await insertProfile(db);
    await seedEverything(db, profileId);

    await db.query("select delete_profile($1)", [profileId]);

    const { rows } = await db.query<{ careers: number; cards: number }>(
      "select (select count(*)::int from careers) as careers, (select count(*)::int from phrase_cards) as cards",
    );

    expect(rows[0]?.careers).toBe(4);
    expect(rows[0]?.cards).toBe(4);
  });

  /**
   * The guard that matters for the future.
   *
   * Everything above passes because of `on delete cascade`, not because of code
   * anybody wrote. A table added later that references `profiles` without it
   * would silently orphan rows — and the delete path would keep reporting
   * success while leaving a person's data in the database.
   */
  test("every table referencing profiles cascades", async ({ db }) => {
    const { rows } = await db.query<{ tablename: string; on_delete: string }>(
      `select src.relname as tablename,
              case c.confdeltype when 'c' then 'CASCADE' else c.confdeltype::text end as on_delete
       from pg_constraint c
       join pg_class src on src.oid = c.conrelid
       join pg_class tgt on tgt.oid = c.confrelid
       where c.contype = 'f' and tgt.relname = 'profiles'
       order by src.relname`,
    );

    expect(rows.length).toBe(CHILD_TABLES.length);
    for (const row of rows) {
      expect(row.on_delete, `${row.tablename} does not cascade`).toBe("CASCADE");
    }
  });
});
