import type { PGlite } from "@electric-sql/pglite";
import { describe, expect } from "vitest";

import { insertProfile, insertTranslation, test } from "./test-support";

/**
 * Signing in merges, it does not attach.
 *
 * `profiles_user_id_key` allows one `user_id` per row, so writing it onto the
 * profile in front of the person works for their first device and raises a
 * unique violation on the second. From there on, a sign-in has to fold one
 * profile into another — and every rule it needs was settled in the README
 * before this function existed, because with the donor row deleted at the end
 * there is no second chance to decide them.
 */
async function savePhrase(db: PGlite, profileId: string, phraseKey: string, phrase: string) {
  await db.query(
    `select save_phrase($1, $2, $3, 'A meaning.', 'data_engineering', 'rewrite',
                        null, null, null, null)`,
    [profileId, phraseKey, phrase],
  );
}

async function merge(db: PGlite, donorId: string, survivorId: string) {
  await db.query("select merge_profile($1, $2)", [donorId, survivorId]);
}

async function countFor(db: PGlite, table: string, profileId: string): Promise<number> {
  const { rows } = await db.query<{ count: string }>(
    `select count(*) as count from ${table} where profile_id = $1`,
    [profileId],
  );

  return Number(rows[0]?.count ?? 0);
}

async function profileExists(db: PGlite, profileId: string): Promise<boolean> {
  const { rows } = await db.query("select 1 from profiles where id = $1", [profileId]);
  return rows.length > 0;
}

const MERGED_TABLES = [
  "learning_signals",
  "pending_sign_ins",
  "saved_phrases",
  "translation_outcomes",
  "translations",
  "user_feedback",
] as const;

describe("merge_profile", () => {
  test("moves the donor's content onto the survivor", async ({ db }) => {
    const donor = await insertProfile(db, "laptop");
    const survivor = await insertProfile(db, "phone");
    await insertTranslation(db, donor, "rw_laptop");
    await insertTranslation(db, survivor, "rw_phone");

    await merge(db, donor, survivor);

    expect(await countFor(db, "translations", survivor)).toBe(2);
  });

  test("removes the donor profile", async ({ db }) => {
    const donor = await insertProfile(db, "laptop");
    const survivor = await insertProfile(db, "phone");

    await merge(db, donor, survivor);

    expect(await profileExists(db, donor)).toBe(false);
    expect(await profileExists(db, survivor)).toBe(true);
  });

  // Content cannot be recreated, so none of it is dropped — every table that
  // hangs off a profile has to come across, not just the ones with a screen.
  test("moves feedback, learning signals and outcomes as well", async ({ db }) => {
    const donor = await insertProfile(db, "laptop");
    const survivor = await insertProfile(db, "phone");
    await insertTranslation(db, donor, "rw_laptop");

    await db.query("select record_feedback($1, 'rw_laptop', 'useful')", [donor]);
    await db.query("select record_outcome($1, 'rw_laptop', 'copied', null)", [donor]);
    await db.query(
      `insert into learning_signals (profile_id, skill, issue, expression, confidence)
       values ($1, 'tone', 'too_casual', 'asap', 0.8)`,
      [donor],
    );

    await merge(db, donor, survivor);

    expect(await countFor(db, "user_feedback", survivor)).toBe(1);
    expect(await countFor(db, "translation_outcomes", survivor)).toBe(1);
    expect(await countFor(db, "learning_signals", survivor)).toBe(1);
  });

  /**
   * The merge deletes the donor, and a pending sign-in hangs off it with
   * `on delete cascade`. Carried across it survives; forgotten it is destroyed
   * by the merge, taking with it the record a waiting device is watching.
   */
  test("carries a pending sign-in across", async ({ db }) => {
    const donor = await insertProfile(db, "laptop");
    const survivor = await insertProfile(db, "phone");
    await db.query(
      `insert into pending_sign_ins (profile_id, email, expires_at)
       values ($1, 'someone@example.com', now() + interval '15 minutes')`,
      [donor],
    );

    await merge(db, donor, survivor);

    expect(await countFor(db, "pending_sign_ins", survivor)).toBe(1);
  });

  test("moves a saved phrase the survivor does not have", async ({ db }) => {
    const donor = await insertProfile(db, "laptop");
    const survivor = await insertProfile(db, "phone");
    await savePhrase(db, donor, "rw_the_next_step_is", "the next step is");

    await merge(db, donor, survivor);

    expect(await countFor(db, "saved_phrases", survivor)).toBe(1);
  });

  /**
   * `saved_phrases_unique_per_profile` is the only constraint a merge can
   * violate, because it is scoped per profile. The survivor's row wins, and the
   * copy that goes takes a `saved_at` with it and nothing a reader would miss.
   */
  test("keeps the survivor's copy when both saved the same phrase", async ({ db }) => {
    const donor = await insertProfile(db, "laptop");
    const survivor = await insertProfile(db, "phone");
    await savePhrase(db, donor, "rw_shared", "from the laptop");
    await savePhrase(db, survivor, "rw_shared", "from the phone");

    await merge(db, donor, survivor);

    const { rows } = await db.query<{ phrase: string }>(
      "select phrase from saved_phrases where profile_id = $1",
      [survivor],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.phrase).toBe("from the phone");
  });

  /**
   * Preferences are a single column and a single tap, so the account's values
   * win. A deliberate configuration outranks one that may belong to a trial, or
   * to somebody else's turn at a shared machine.
   */
  test("leaves the survivor's preferences alone", async ({ db }) => {
    const donor = await insertProfile(db, "laptop");
    const survivor = await insertProfile(db, "phone");
    await db.query("update profiles set career = 'data_science' where id = $1", [donor]);
    await db.query("update profiles set career = 'software_architecture' where id = $1", [
      survivor,
    ]);

    await merge(db, donor, survivor);

    const { rows } = await db.query<{ career: string }>(
      "select career from profiles where id = $1",
      [survivor],
    );

    expect(rows[0]?.career).toBe("software_architecture");
  });

  // Not a preference, and "the account wins" is plainly wrong for it.
  test("carries the later last_seen_at across", async ({ db }) => {
    const donor = await insertProfile(db, "laptop");
    const survivor = await insertProfile(db, "phone");
    await db.query("update profiles set last_seen_at = '2026-09-27T10:00:00Z' where id = $1", [
      donor,
    ]);
    await db.query("update profiles set last_seen_at = '2026-09-01T10:00:00Z' where id = $1", [
      survivor,
    ]);

    await merge(db, donor, survivor);

    const { rows } = await db.query<{ last_seen_at: Date }>(
      "select last_seen_at from profiles where id = $1",
      [survivor],
    );

    expect(rows[0]?.last_seen_at.toISOString()).toBe("2026-09-27T10:00:00.000Z");
  });

  // A sign-in gets retried, and a donor that is already gone is not an error.
  test("does nothing the second time", async ({ db }) => {
    const donor = await insertProfile(db, "laptop");
    const survivor = await insertProfile(db, "phone");
    await insertTranslation(db, donor, "rw_laptop");

    await merge(db, donor, survivor);
    await merge(db, donor, survivor);

    expect(await countFor(db, "translations", survivor)).toBe(1);
    expect(await profileExists(db, survivor)).toBe(true);
  });

  /**
   * Folding a profile into itself would re-parent every row onto the id that is
   * deleted in the next statement, and `on delete cascade` would take the lot.
   * A person signing in would watch everything disappear.
   */
  test("refuses to merge a profile into itself", async ({ db }) => {
    const profile = await insertProfile(db, "laptop");

    await expect(merge(db, profile, profile)).rejects.toThrow();
  });

  /**
   * The donor is always the anonymous side. A donor with a `user_id` is a
   * second account, and merging those would delete one of them — a decision
   * nobody has taken.
   */
  test("refuses a donor that already belongs to an account", async ({ db }) => {
    const donor = await insertProfile(db, "laptop");
    const survivor = await insertProfile(db, "phone");
    const { rows } = await db.query<{ id: string }>(
      "insert into users (email) values ('someone@example.com') returning id",
    );
    await db.query("update profiles set user_id = $1 where id = $2", [rows[0]?.id, donor]);

    await expect(merge(db, donor, survivor)).rejects.toThrow();
  });
  /**
   * The guard that matters for the future.
   *
   * `delete_profile` gets this for free: every table references `profiles` with
   * `on delete cascade`, so a table added later is still emptied. A merge has
   * no such luck — it re-parents by naming each table, and one this function
   * has never heard of is not left behind, it is destroyed with the donor.
   *
   * So the tables that reference `profiles` are compared against the ones the
   * merge is actually exercised with, here and in `db/sign-in.test.ts`.
   */
  test("carries across every table that references profiles", async ({ db }) => {
    const { rows } = await db.query<{ tablename: string }>(
      `select distinct src.relname as tablename
       from pg_constraint c
       join pg_class src on src.oid = c.conrelid
       join pg_class tgt on tgt.oid = c.confrelid
       where c.contype = 'f' and tgt.relname = 'profiles'
       order by 1`,
    );

    expect(rows.map((row) => row.tablename)).toEqual([...MERGED_TABLES]);
  });
});
