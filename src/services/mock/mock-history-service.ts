import { translationRecordSchema, type TranslationRecord } from "@/contracts/translation";
import type { HistoryService } from "@/services/history-service";

import { createLocalCollectionStore, type CollectionStore } from "./local-store";

export const TRANSLATION_HISTORY_STORAGE_KEY = "pec.translations.v1";

/** Keeps the mock store bounded; the real table has no such limit. */
const MAX_ENTRIES = 50;

export function createMockHistoryService(
  store: CollectionStore<TranslationRecord> = createLocalCollectionStore(
    TRANSLATION_HISTORY_STORAGE_KEY,
    translationRecordSchema,
  ),
): HistoryService {
  return {
    async list(limit?: number): Promise<TranslationRecord[]> {
      const entries = store.read().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return limit === undefined ? entries : entries.slice(0, limit);
    },

    async record(entry: TranslationRecord): Promise<void> {
      const parsed = translationRecordSchema.parse(entry);
      const rest = store.read().filter((item) => item.id !== parsed.id);

      store.write([parsed, ...rest].slice(0, MAX_ENTRIES));
    },

    async clear(): Promise<void> {
      store.write([]);
    },
  };
}
