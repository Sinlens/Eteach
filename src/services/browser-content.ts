import { savedPhraseSchema, type SavedPhrase } from "@/contracts/saved-phrase";
import { translationRecordSchema, type TranslationRecord } from "@/contracts/translation";

import { createLocalCollectionStore, type CollectionStore } from "./mock/local-store";
import { SAVED_PHRASES_STORAGE_KEY } from "./mock/mock-saved-phrase-service";
import { TRANSLATION_HISTORY_STORAGE_KEY } from "./mock/mock-history-service";

/**
 * What this browser is holding, whichever backend is live.
 *
 * The keys are declared next to the mock adapters because those adapters write
 * them, but the content outlives the adapter: a browser that ran in `mock` mode
 * keeps those entries after the app is switched to `supabase`, and nothing
 * reads them again.
 *
 * That is exactly why this exists. The delete path promises that nothing of
 * yours is stored any more. Clearing the database while leaving the same
 * sentences sitting in local storage would make that promise false on the one
 * machine the person actually controls — and the app's own silence about those
 * entries is what makes them easy to forget.
 */
export type BrowserContentStores = {
  history: CollectionStore<TranslationRecord>;
  savedPhrases: CollectionStore<SavedPhrase>;
};

export function createBrowserContentStores(): BrowserContentStores {
  return {
    history: createLocalCollectionStore(TRANSLATION_HISTORY_STORAGE_KEY, translationRecordSchema),
    savedPhrases: createLocalCollectionStore(SAVED_PHRASES_STORAGE_KEY, savedPhraseSchema),
  };
}

/**
 * Empties every store this browser writes content into.
 *
 * A store added later and not listed here would survive a delete the person was
 * told had happened, which is the failure mode worth guarding: it is silent,
 * and it is the opposite of what was promised.
 */
export function clearBrowserContent(
  stores: BrowserContentStores = createBrowserContentStores(),
): void {
  stores.history.write([]);
  stores.savedPhrases.write([]);
}
