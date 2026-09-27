import type { FeedbackRequest } from "@/contracts/feedback";
import type { SavedPhrase } from "@/contracts/saved-phrase";
import type { TranslationRecord } from "@/contracts/translation";
import { ensureAnonymousId, resetAnonymousId } from "@/lib/anonymous-id";
import {
  clearHistoryFn,
  deleteProfileFn,
  listHistoryFn,
  listSavedPhrasesFn,
  recordTranslationFn,
  removeSavedPhraseFn,
  savePhraseFn,
  submitFeedbackFn,
} from "./data-functions";
import { clearBrowserContent } from "@/services/browser-content";
import type { FeedbackService } from "@/services/feedback-service";
import type { HistoryService } from "@/services/history-service";
import type { SavedPhraseService } from "@/services/saved-phrase-service";
import type { StoredDataService } from "@/services/stored-data-service";

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

export function createRemoteStoredDataService(): StoredDataService {
  return {
    async deleteEverything(): Promise<void> {
      // Order is the whole correctness argument. The server call goes first and
      // nothing local changes until it has returned: rotating the key on a
      // failed request would leave the rows in the database with the only key
      // that reaches them already thrown away — unreachable, undeletable, and
      // reported to the person as deleted.
      await deleteProfileFn({ data: { anonymousKey: ensureAnonymousId() } });

      // The database is not the only place content lives. A browser that ran in
      // `mock` mode still holds those entries, and this mode never reads them
      // again — so they would quietly outlive a delete that promised otherwise.
      clearBrowserContent();
      resetAnonymousId();
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
