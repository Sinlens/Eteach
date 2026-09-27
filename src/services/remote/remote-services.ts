import type { FeedbackRequest } from "@/contracts/feedback";
import type { SavedPhrase } from "@/contracts/saved-phrase";
import type { TranslationRecord } from "@/contracts/translation";
import { resetAnonymousId } from "@/lib/anonymous-id";
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
 * covered by the schema tests; all that happens here is crossing the server
 * boundary. Identity is not passed across it — the server reads it from a
 * cookie, so there is nothing here to pick up and nothing to get wrong.
 */
const DEFAULT_HISTORY_LIMIT = 50;

export function createRemoteHistoryService(): HistoryService {
  return {
    async list(limit?: number): Promise<TranslationRecord[]> {
      return listHistoryFn({ data: { limit: limit ?? DEFAULT_HISTORY_LIMIT } });
    },

    async record(entry: TranslationRecord): Promise<void> {
      await recordTranslationFn({ data: { record: entry } });
    },

    async clear(): Promise<void> {
      await clearHistoryFn();
    },
  };
}

export function createRemoteSavedPhraseService(): SavedPhraseService {
  return {
    async list(): Promise<SavedPhrase[]> {
      return listSavedPhrasesFn();
    },

    async save(phrase: SavedPhrase): Promise<void> {
      await savePhraseFn({ data: { phrase } });
    },

    async remove(id: string): Promise<void> {
      await removeSavedPhraseFn({ data: { id } });
    },
  };
}

export function createRemoteStoredDataService(): StoredDataService {
  return {
    async deleteEverything(): Promise<void> {
      // The rows and the key that reaches them now go on the same side of the
      // boundary: `deleteProfileFn` rotates the cookie itself, and only after
      // the delete has returned. That ordering used to be argued for here, and
      // it is stronger where it is now — a failed request cannot leave the rows
      // behind with their only key already thrown away.
      await deleteProfileFn();

      // The database is not the only place content lives. A browser that ran in
      // `mock` mode still holds those entries and its own identity, and this
      // mode never reads either again — so they would quietly outlive a delete
      // that promised otherwise.
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
          translationId: request.translationId,
          feedback: request.feedback,
        },
      });
    },
  };
}
