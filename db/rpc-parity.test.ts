import { describe, expect } from "vitest";

import {
  RPC_FUNCTIONS,
  clearHistoryCall,
  deleteProfileCall,
  ensureProfileCall,
  listHistoryCall,
  mergeProfileCall,
  listSavedPhrasesCall,
  recordFeedbackCall,
  recordOutcomeCall,
  recordTranslationCall,
  removeSavedPhraseCall,
  savePhraseCall,
  type RpcCall,
} from "@/server/db/rpc";

import { test } from "./test-support";

/**
 * The gap this closes.
 *
 * PostgREST resolves a function by its name and the set of argument names it
 * receives. Get either wrong and the failure appears at runtime, against a real
 * project, as an unhelpful 404 — the one class of mistake the schema tests
 * could not catch. Here the calls the client actually builds are compared
 * against the signatures PostgreSQL actually has.
 */
const SAMPLE_CALLS: RpcCall[] = [
  ensureProfileCall("device_1"),
  mergeProfileCall({
    donorProfileId: "00000000-0000-0000-0000-000000000000",
    survivorProfileId: "00000000-0000-0000-0000-000000000001",
  }),
  recordTranslationCall({
    profileId: "00000000-0000-0000-0000-000000000000",
    translationId: "rw_01",
    inputText: "I already finished the pipeline.",
    career: "data_engineering",
    tone: "professional",
    locale: "en-US",
    result: {
      id: "rw_01",
      professionalVersion: "I've finished it.",
      alternativeVersion: "It is done.",
      explanation: "Because.",
      keyPhrases: [],
      vocabulary: [],
    },
  }),
  listHistoryCall("00000000-0000-0000-0000-000000000000", 8),
  clearHistoryCall("00000000-0000-0000-0000-000000000000"),
  listSavedPhrasesCall("00000000-0000-0000-0000-000000000000"),
  removeSavedPhraseCall("00000000-0000-0000-0000-000000000000", "rw_the_next_step_is"),
  savePhraseCall({
    profileId: "00000000-0000-0000-0000-000000000000",
    phraseKey: "rw_the_next_step_is",
    phrase: "the next step is",
    meaning: "Introduces the next action.",
    career: "data_engineering",
    source: "rewrite",
    example: null,
    category: null,
    difficulty: null,
    phraseCardId: null,
  }),
  recordFeedbackCall({
    profileId: "00000000-0000-0000-0000-000000000000",
    translationId: "rw_01",
    feedback: "too_formal",
  }),
  recordOutcomeCall({
    profileId: "00000000-0000-0000-0000-000000000000",
    translationId: "rw_01",
    action: "edited",
    acceptedVersion: "What was actually sent.",
  }),
  deleteProfileCall("00000000-0000-0000-0000-000000000000"),
];

describe("rpc parity between TypeScript and PostgreSQL", () => {
  test("every call the client builds exists with exactly those argument names", async ({ db }) => {
    const { rows } = await db.query<{ proname: string; proargnames: string[] | null }>(
      `select p.proname, p.proargnames
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prokind = 'f'`,
    );

    const signatures = new Map(rows.map((row) => [row.proname, row.proargnames ?? []]));

    for (const call of SAMPLE_CALLS) {
      const declared = signatures.get(call.fn);

      expect(declared, `function "${call.fn}" does not exist in the database`).toBeDefined();
      expect(Object.keys(call.args).sort(), `arguments of "${call.fn}"`).toEqual(
        [...(declared ?? [])].sort(),
      );
    }
  });

  test("covers every function the client declares", () => {
    expect(SAMPLE_CALLS.map((call) => call.fn).sort()).toEqual([...RPC_FUNCTIONS].sort());
  });

  test("the database exposes no function the client does not know about", async ({ db }) => {
    const { rows } = await db.query<{ proname: string }>(
      `select p.proname
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prokind = 'f'
       order by p.proname`,
    );

    expect(rows.map((row) => row.proname)).toEqual([...RPC_FUNCTIONS].sort());
  });
});
