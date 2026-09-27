import { describe, expect, it } from "vitest";

import type { SavedPhrase } from "@/contracts/saved-phrase";
import type { TranslationRecord } from "@/contracts/translation";
import { ANONYMOUS_ID_STORAGE_KEY, createMemoryKeyValueStore } from "@/lib/anonymous-id";

import { createMemoryCollectionStore } from "./local-store";
import { createMockStoredDataService } from "./mock-stored-data-service";

const translation: TranslationRecord = {
  id: "rw_01",
  inputText: "hey can u check this asap",
  career: "data_engineering",
  tone: "professional",
  locale: "en-US",
  createdAt: "2026-09-26T12:00:00.000Z",
  result: {
    id: "rw_01",
    professionalVersion: "Could you review this when you have a moment?",
    alternativeVersion: "Would you be able to take a look at this?",
    explanation: "It asks without pressing.",
    keyPhrases: [],
    vocabulary: [],
  },
};

const phrase: SavedPhrase = {
  id: "rw_the_next_step_is",
  phrase: "the next step is",
  meaning: "Introduces the next action.",
  example: null,
  career: "data_engineering",
  category: null,
  difficulty: null,
  source: "rewrite",
  savedAt: "2026-09-26T12:00:00.000Z",
};

function build() {
  const history = createMemoryCollectionStore<TranslationRecord>([translation]);
  const savedPhrases = createMemoryCollectionStore<SavedPhrase>([phrase]);
  const identity = createMemoryKeyValueStore({
    [ANONYMOUS_ID_STORAGE_KEY]: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  });

  return {
    history,
    savedPhrases,
    identity,
    service: createMockStoredDataService({ stores: { history, savedPhrases }, identity }),
  };
}

describe("createMockStoredDataService", () => {
  it("empties the history", async () => {
    const { history, service } = build();

    await service.deleteEverything();

    expect(history.read()).toEqual([]);
  });

  it("empties the saved phrases", async () => {
    const { savedPhrases, service } = build();

    await service.deleteEverything();

    expect(savedPhrases.read()).toEqual([]);
  });

  // Keeping the key would leave the browser carrying the identifier the deleted
  // rows were filed under.
  it("issues a new identity", async () => {
    const { identity, service } = build();
    const before = identity.read(ANONYMOUS_ID_STORAGE_KEY);

    await service.deleteEverything();

    const after = identity.read(ANONYMOUS_ID_STORAGE_KEY);

    expect(after).not.toBe(before);
    expect(after).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("can be called again with nothing left to remove", async () => {
    const { service, history } = build();

    await service.deleteEverything();
    await expect(service.deleteEverything()).resolves.toBeUndefined();

    expect(history.read()).toEqual([]);
  });
});
