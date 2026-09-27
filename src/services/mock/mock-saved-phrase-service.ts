import { savedPhraseSchema, type SavedPhrase } from "@/contracts/saved-phrase";
import type { SavedPhraseService } from "@/services/saved-phrase-service";

import { createLocalCollectionStore, type CollectionStore } from "./local-store";

export const SAVED_PHRASES_STORAGE_KEY = "pec.saved-phrases.v1";

export function createMockSavedPhraseService(
  store: CollectionStore<SavedPhrase> = createLocalCollectionStore(
    SAVED_PHRASES_STORAGE_KEY,
    savedPhraseSchema,
  ),
): SavedPhraseService {
  return {
    async list(): Promise<SavedPhrase[]> {
      return store.read().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    },

    async save(phrase: SavedPhrase): Promise<void> {
      const parsed = savedPhraseSchema.parse(phrase);
      const rest = store.read().filter((item) => item.id !== parsed.id);

      store.write([parsed, ...rest]);
    },

    async remove(id: string): Promise<void> {
      store.write(store.read().filter((item) => item.id !== id));
    },
  };
}
