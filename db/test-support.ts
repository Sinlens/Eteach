import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, test as base } from "vitest";

// The schema itself lives where the Supabase CLI expects it; these tests only
// read it. Reference data is a migration too, so there is a single source.
const MIGRATIONS_DIR = fileURLToPath(new URL("../supabase/migrations/", import.meta.url));

function readSqlFiles(directory: string): string[] {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(join(directory, name), "utf8"));
}

let instance: PGlite | undefined;

/**
 * One PostgreSQL engine per test file, built on first use.
 *
 * Migrations are discovered from disk and applied in filename order, so adding
 * a migration needs no change here.
 */
async function database(): Promise<PGlite> {
  if (instance) return instance;

  const db = new PGlite();
  for (const sql of readSqlFiles(MIGRATIONS_DIR)) {
    await db.exec(sql);
  }

  instance = db;
  return db;
}

afterAll(async () => {
  await instance?.close();
  instance = undefined;
});

/**
 * A test with a `db` already open and isolated.
 *
 * Booting PGlite costs seconds, so the engine is shared and isolation comes
 * from a transaction that is rolled back when the case ends. Nothing a case
 * writes is visible to the next one.
 *
 * One consequence of real transactions: a failed statement aborts the
 * surrounding transaction, so a case asserting a rejection must not run further
 * queries after it.
 */
export const test = base.extend<{ db: PGlite }>({
  // Vitest reads the destructuring pattern to work out fixture dependencies, so
  // the empty pattern is required — this fixture depends on nothing. The second
  // argument is positional, so it is named `provide` rather than vitest's usual
  // `use`, which trips rules-of-hooks now that React 19 has a `use` hook.
  // eslint-disable-next-line no-empty-pattern
  db: async ({}, provide) => {
    const db = await database();

    await db.exec("begin");
    try {
      await provide(db);
    } finally {
      await db.exec("rollback");
    }
  },
});

/** Inserts a profile directly, for cases exercising the schema itself. */
export async function insertProfile(db: PGlite, anonymousKey = "device_1"): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "insert into profiles (anonymous_key, career) values ($1, 'data_engineering') returning id",
    [anonymousKey],
  );

  const id = rows[0]?.id;
  if (!id) throw new Error("profile was not created");
  return id;
}

/** Goes through the function, for cases exercising the API surface. */
export async function ensureProfile(db: PGlite, anonymousKey = "device_1"): Promise<string> {
  const { rows } = await db.query<{ ensure_profile: string }>(
    "select ensure_profile($1) as ensure_profile",
    [anonymousKey],
  );

  const id = rows[0]?.ensure_profile;
  if (!id) throw new Error("profile was not created");
  return id;
}

export async function insertTranslation(
  db: PGlite,
  profileId: string,
  id = "rw_01",
): Promise<void> {
  await db.query(
    `insert into translations
       (id, profile_id, input_text, professional_version, career, tone, locale, result)
     values ($1, $2, $3, $4, 'data_engineering', 'professional', 'en-US', $5)`,
    [
      id,
      profileId,
      "I already finished the pipeline but we still need to test it.",
      "I've finished building the pipeline, but it still needs to be tested.",
      buildResult(id, "I've finished building the pipeline, but it still needs to be tested."),
    ],
  );
}

export function buildResult(id: string, professionalVersion: string): string {
  return JSON.stringify({
    id,
    professionalVersion,
    alternativeVersion: "The pipeline implementation is complete, and the next step is testing.",
    explanation: "It communicates status and the remaining action.",
    keyPhrases: [{ phrase: "the next step is", meaning: "Introduces the next action." }],
    vocabulary: [],
  });
}
