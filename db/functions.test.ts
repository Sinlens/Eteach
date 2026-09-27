import { describe, expect } from "vitest";

import { buildResult, ensureProfile, test } from "./test-support";

/**
 * The point of these tests: this is the code `supabase-js` will call through
 * `.rpc(...)`, and it is exercised here against a real PostgreSQL engine. What
 * is left on the client side is a function name and its arguments.
 */
describe("ensure_profile", () => {
  test("creates a profile the first time a device is seen", async ({ db }) => {
    const id = await ensureProfile(db, "device_1");

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("returns the same profile on a second visit instead of duplicating it", async ({ db }) => {
    const first = await ensureProfile(db, "device_1");
    const second = await ensureProfile(db, "device_1");

    expect(second).toBe(first);

    const { rows } = await db.query<{ count: number }>(
      "select count(*)::int as count from profiles",
    );
    expect(rows[0]?.count).toBe(1);
  });

  test("gives separate devices separate profiles", async ({ db }) => {
    const first = await ensureProfile(db, "device_1");
    const second = await ensureProfile(db, "device_2");

    expect(second).not.toBe(first);
  });
});

describe("record_translation", () => {
  test("derives the flattened column from the stored payload", async ({ db }) => {
    const profileId = await ensureProfile(db);

    await db.query(
      "select record_translation($1, 'rw_01', $2, 'data_engineering', 'professional', 'en-US', $3)",
      [profileId, "I already finished the pipeline.", buildResult("rw_01", "I've finished it.")],
    );

    const { rows } = await db.query<{ professional_version: string }>(
      "select professional_version from translations where id = 'rw_01'",
    );

    expect(rows[0]?.professional_version).toBe("I've finished it.");
  });

  test("upserts so re-recording the same rewrite does not duplicate it", async ({ db }) => {
    const profileId = await ensureProfile(db);
    const call =
      "select record_translation($1, 'rw_01', $2, 'data_engineering', 'professional', 'en-US', $3)";

    await db.query(call, [profileId, "first", buildResult("rw_01", "First version.")]);
    await db.query(call, [profileId, "second", buildResult("rw_01", "Second version.")]);

    const { rows } = await db.query<{ count: number; professional_version: string }>(
      "select count(*) over ()::int as count, professional_version from translations",
    );

    expect(rows[0]?.count).toBe(1);
    expect(rows[0]?.professional_version).toBe("Second version.");
  });
});

describe("list_history", () => {
  test("returns the newest rewrites first and honours the limit", async ({ db }) => {
    const profileId = await ensureProfile(db);
    const recorded: Array<[string, string]> = [
      ["rw_01", "2026-09-24T10:00:00Z"],
      ["rw_02", "2026-09-25T10:00:00Z"],
      ["rw_03", "2026-09-26T10:00:00Z"],
    ];

    for (const [id, createdAt] of recorded) {
      await db.query(
        "select record_translation($1, $2, 'input', 'data_engineering', 'professional', 'en-US', $3)",
        [profileId, id, buildResult(id, `Version ${id}.`)],
      );
      await db.query("update translations set created_at = $1 where id = $2", [createdAt, id]);
    }

    const { rows } = await db.query<{ id: string }>("select id from list_history($1, 2)", [
      profileId,
    ]);

    expect(rows.map((row) => row.id)).toEqual(["rw_03", "rw_02"]);
  });

  test("never leaks another profile's history", async ({ db }) => {
    const mine = await ensureProfile(db, "device_1");
    const theirs = await ensureProfile(db, "device_2");

    await db.query(
      "select record_translation($1, 'rw_theirs', 'input', 'data_engineering', 'professional', 'en-US', $2)",
      [theirs, buildResult("rw_theirs", "Not mine.")],
    );

    const { rows } = await db.query("select id from list_history($1, 10)", [mine]);

    expect(rows).toEqual([]);
  });
});

describe("save_phrase", () => {
  const SAVE = `select save_phrase($1, 'rw_the_next_step_is', 'the next step is',
                  'Introduces the next action.', 'data_engineering', 'rewrite',
                  null, null, null, null)`;

  test("stores a phrase saved from a rewrite", async ({ db }) => {
    const profileId = await ensureProfile(db);

    await db.query(SAVE, [profileId]);

    const { rows } = await db.query<{ count: number }>(
      "select count(*)::int as count from saved_phrases",
    );
    expect(rows[0]?.count).toBe(1);
  });

  test("upserts, so saving the same phrase twice keeps one row", async ({ db }) => {
    const profileId = await ensureProfile(db);

    await db.query(SAVE, [profileId]);
    await db.query(SAVE, [profileId]);

    const { rows } = await db.query<{ count: number }>(
      "select count(*)::int as count from saved_phrases",
    );
    expect(rows[0]?.count).toBe(1);
  });

  test("stores a card-sourced phrase with its card and category", async ({ db }) => {
    const profileId = await ensureProfile(db);

    await db.query(
      `select save_phrase($1, 'pc_data_science_01', 'I''d be happy to walk you through this',
         'Offers to explain your work.', 'data_science', 'phrase_card',
         'I''d be happy to walk you through how we evaluated the model.',
         'technical_explanations', 'intermediate', 'pc_data_science_01')`,
      [profileId],
    );

    const { rows } = await db.query<{ category: string; phrase_card_id: string }>(
      "select category, phrase_card_id from saved_phrases",
    );

    expect(rows[0]?.category).toBe("technical_explanations");
    expect(rows[0]?.phrase_card_id).toBe("pc_data_science_01");
  });

  // The function does not get to bypass the table's own rules.
  test("still refuses a rewrite-sourced phrase that claims a card", async ({ db }) => {
    const profileId = await ensureProfile(db);

    await expect(
      db.query(
        `select save_phrase($1, 'rw_x', 'a phrase', 'a meaning', 'data_engineering',
           'rewrite', null, null, null, 'pc_data_science_01')`,
        [profileId],
      ),
    ).rejects.toThrow();
  });
});

describe("remove_saved_phrase", () => {
  test("removes only the named phrase, and only for that profile", async ({ db }) => {
    const mine = await ensureProfile(db, "device_1");
    const theirs = await ensureProfile(db, "device_2");
    const save = `select save_phrase($1, $2, 'a phrase', 'a meaning', 'data_engineering',
                    'rewrite', null, null, null, null)`;

    await db.query(save, [mine, "rw_keep"]);
    await db.query(save, [mine, "rw_drop"]);
    await db.query(save, [theirs, "rw_drop"]);

    await db.query("select remove_saved_phrase($1, 'rw_drop')", [mine]);

    const { rows } = await db.query<{ profile_id: string; phrase_key: string }>(
      "select profile_id, phrase_key from saved_phrases order by phrase_key",
    );

    expect(rows.map((row) => row.phrase_key)).toEqual(["rw_drop", "rw_keep"]);
    expect(rows.find((row) => row.phrase_key === "rw_drop")?.profile_id).toBe(theirs);
  });
});

describe("list_saved_phrases", () => {
  test("returns newest first and never another profile's", async ({ db }) => {
    const mine = await ensureProfile(db, "device_1");
    const theirs = await ensureProfile(db, "device_2");
    const save = `select save_phrase($1, $2, 'a phrase', 'a meaning', 'data_engineering',
                    'rewrite', null, null, null, null)`;

    await db.query(save, [mine, "rw_older"]);
    await db.query(save, [mine, "rw_newer"]);
    await db.query(save, [theirs, "rw_theirs"]);
    await db.query("update saved_phrases set saved_at = $1 where phrase_key = $2", [
      "2026-09-20T10:00:00Z",
      "rw_older",
    ]);
    await db.query("update saved_phrases set saved_at = $1 where phrase_key = $2", [
      "2026-09-26T10:00:00Z",
      "rw_newer",
    ]);

    const { rows } = await db.query<{ phrase_key: string }>(
      "select phrase_key from list_saved_phrases($1)",
      [mine],
    );

    expect(rows.map((row) => row.phrase_key)).toEqual(["rw_newer", "rw_older"]);
  });
});

describe("clear_history", () => {
  test("clears only the calling profile's history", async ({ db }) => {
    const mine = await ensureProfile(db, "device_1");
    const theirs = await ensureProfile(db, "device_2");
    const record =
      "select record_translation($1, $2, 'input', 'data_engineering', 'professional', 'en-US', $3)";

    await db.query(record, [mine, "rw_mine", buildResult("rw_mine", "Mine.")]);
    await db.query(record, [theirs, "rw_theirs", buildResult("rw_theirs", "Theirs.")]);

    await db.query("select clear_history($1)", [mine]);

    const { rows } = await db.query<{ id: string }>("select id from translations");
    expect(rows.map((row) => row.id)).toEqual(["rw_theirs"]);
  });
});

describe("record_feedback", () => {
  test("is idempotent, so the same signal sent twice counts once", async ({ db }) => {
    const profileId = await ensureProfile(db);
    await db.query(
      "select record_translation($1, 'rw_01', 'input', 'data_engineering', 'professional', 'en-US', $2)",
      [profileId, buildResult("rw_01", "A version.")],
    );

    await db.query("select record_feedback($1, 'rw_01', 'too_formal')", [profileId]);
    await db.query("select record_feedback($1, 'rw_01', 'too_formal')", [profileId]);

    const { rows } = await db.query<{ count: number }>(
      "select count(*)::int as count from user_feedback",
    );
    expect(rows[0]?.count).toBe(1);
  });
});

describe("record_outcome", () => {
  test("stores the signal Phase 5 actually needs", async ({ db }) => {
    const profileId = await ensureProfile(db);
    await db.query(
      "select record_translation($1, 'rw_01', 'input', 'data_engineering', 'professional', 'en-US', $2)",
      [profileId, buildResult("rw_01", "A version.")],
    );

    await db.query("select record_outcome($1, 'rw_01', 'edited', $2)", [
      profileId,
      "What the user actually sent.",
    ]);

    const { rows } = await db.query<{ action: string; accepted_version: string }>(
      "select action, accepted_version from translation_outcomes",
    );

    expect(rows[0]?.action).toBe("edited");
    expect(rows[0]?.accepted_version).toBe("What the user actually sent.");
  });
});

describe("security posture", () => {
  // A SECURITY DEFINER function bypasses every policy written later. This is
  // the guard that stops one being added by accident.
  test("defines no SECURITY DEFINER functions", async ({ db }) => {
    const { rows } = await db.query<{ proname: string }>(
      `select p.proname
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prosecdef = true`,
    );

    expect(rows).toEqual([]);
  });
});
