import type { FeedbackRequest } from "@/contracts/feedback";
import type { SavedPhrase } from "@/contracts/saved-phrase";
import type { TranslationRecord } from "@/contracts/translation";
import { ensureAnonymousId } from "@/lib/anonymous-id";
import {
  clearHistoryFn,
  listHistoryFn,
  listSavedPhrasesFn,
  recordTranslationFn,
  removeSavedPhraseFn,
  savePhraseFn,
  submitFeedbackFn,
} from "./data-functions";
import type { FeedbackService } from "@/services/feedback-service";
import type { HistoryService } from "@/services/history-service";
import type { SavedPhraseService } from "@/services/saved-phrase-service";

/**
 * The same ports, backed by the database instead of browser storage.
 *
 * These are deliberately thin. Every rule lives in a SQL function, which is
 * covered by the schema tests; all that happens here is picking up the device's
 * anonymous key and crossing the server boundary.
 */
const DEFAULT_HISTORY_LIMIT = 50;

export function createRemoteHistoryService(): HistoryService {
  return {
    async list(limit?: number): Promise<TranslationRecord[]> {
      return listHistoryFn({
        data: { anonymousKey: ensureAnonymousId(), limit: limit ?? DEFAULT_HISTORY_LIMIT },
      });
    },

    async record(entry: TranslationRecord): Promise<void> {
      await recordTranslationFn({ data: { anonymousKey: ensureAnonymousId(), record: entry } });
    },

    async clear(): Promise<void> {
      await clearHistoryFn({ data: { anonymousKey: ensureAnonymousId() } });
    },
  };
}

export function createRemoteSavedPhraseService(): SavedPhraseService {
  return {
    async list(): Promise<SavedPhrase[]> {
      return listSavedPhrasesFn({ data: { anonymousKey: ensureAnonymousId() } });
    },

    async save(phrase: SavedPhrase): Promise<void> {
      await savePhraseFn({ data: { anonymousKey: ensureAnonymousId(), phrase } });
    },

    async remove(id: string): Promise<void> {
      await removeSavedPhraseFn({ data: { anonymousKey: ensureAnonymousId(), id } });
    },
  };
}

export function createRemoteFeedbackService(): FeedbackService {
  return {
    async submit(request: FeedbackRequest): Promise<void> {
      await submitFeedbackFn({
        data: {
          anonymousKey: ensureAnonymousId(),
          translationId: request.translationId,
          feedback: request.feedback,
        },
      });
    },
  };
}
