import { describe, expect, it } from "vitest";

import type { SavedPhrase } from "@/contracts/saved-phrase";
import type { TranslationRecord } from "@/contracts/translation";

import { clearBrowserContent } from "./browser-content";
import { createMemoryCollectionStore } from "./mock/local-store";

const translation: TranslationRecord = {
  id: "rw_01",
  inputText: "hi Sarah, about the offer you mentioned",
  career: "data_engineering",
  tone: "professional",
  locale: "en-US",
  createdAt: "2026-09-26T12:00:00.000Z",
  result: {
    id: "rw_01",
    professionalVersion: "Thank you for mentioning the offer.",
    alternativeVersion: "I appreciate you raising the offer.",
    explanation: "It acknowledges without committing.",
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

/**
 * These entries outlive the adapter that wrote them. A browser that ran in
 * `mock` mode still holds them after the app is switched to `supabase`, where
 * nothing reads them again — so the delete path has to name them explicitly or
 * they survive a deletion somebody was told had happened.
 */
describe("clearBrowserContent", () => {
  it("empties the history and the saved phrases together", () => {
    const stores = {
      history: createMemoryCollectionStore<TranslationRecord>([translation]),
      savedPhrases: createMemoryCollectionStore<SavedPhrase>([phrase]),
    };

    clearBrowserContent(stores);

    expect(stores.history.read()).toEqual([]);
    expect(stores.savedPhrases.read()).toEqual([]);
  });

  it("is safe to run when there is nothing left", () => {
    const stores = {
      history: createMemoryCollectionStore<TranslationRecord>(),
      savedPhrases: createMemoryCollectionStore<SavedPhrase>(),
    };

    clearBrowserContent(stores);
    clearBrowserContent(stores);

    expect(stores.history.read()).toEqual([]);
  });
});
