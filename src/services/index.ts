import type { FeedbackService } from "./feedback-service";
import type { HistoryService } from "./history-service";
import { createMockFeedbackService } from "./mock/mock-feedback-service";
import { createMockHistoryService } from "./mock/mock-history-service";
import { createMockRewriteService } from "./mock/mock-rewrite-service";
import { createMockSavedPhraseService } from "./mock/mock-saved-phrase-service";
import { createMockStoredDataService } from "./mock/mock-stored-data-service";
import { createRemoteRewriteService } from "./remote/remote-rewrite-service";
import {
  createRemoteFeedbackService,
  createRemoteHistoryService,
  createRemoteSavedPhraseService,
  createRemoteStoredDataService,
} from "./remote/remote-services";
import type { RewriteService } from "./rewrite-service";
import type { SavedPhraseService } from "./saved-phrase-service";
import type { StoredDataService } from "./stored-data-service";

export * from "./feedback-service";
export * from "./history-service";
export * from "./rewrite-service";
export * from "./saved-phrase-service";
export * from "./stored-data-service";
export { createMockStoredDataService } from "./mock/mock-stored-data-service";
export { createMockRewriteService } from "./mock/mock-rewrite-service";
export type { MockRewriteServiceOptions } from "./mock/mock-rewrite-service";
export { createRemoteRewriteService } from "./remote/remote-rewrite-service";
export type { RewriteCall } from "./remote/remote-rewrite-service";
export { createMockFeedbackService } from "./mock/mock-feedback-service";
export type { MockFeedbackService, MockFeedbackServiceOptions } from "./mock/mock-feedback-service";
export { createMockHistoryService } from "./mock/mock-history-service";
export { createMockSavedPhraseService } from "./mock/mock-saved-phrase-service";
export { PHRASE_CARDS, phraseCardForCareer } from "./mock/phrase-cards";
export {
  createLocalCollectionStore,
  createMemoryCollectionStore,
  type CollectionStore,
} from "./mock/local-store";

/**
 * Which implementations are live.
 *
 * `mock` keeps everything in browser storage and needs no infrastructure, so it
 * stays the default. `supabase` routes the same ports through the server
 * boundary into the database.
 */
export type DataBackend = "mock" | "supabase";

export const dataBackend: DataBackend =
  import.meta.env["VITE_DATA_BACKEND"] === "supabase" ? "supabase" : "mock";

const remote = dataBackend === "supabase";

/**
 * Where the rewrite comes from — a separate axis from the data backend on
 * purpose. The model and the database are independently deployable: authored
 * fixtures against a real database is a useful state, and so is a live workflow
 * against browser storage.
 *
 * This flag is `VITE_`-prefixed because it is not a secret — it names an
 * adapter. The webhook it eventually reaches is not: see `src/server/n8n.ts`.
 */
export type RewriteBackend = "mock" | "n8n";

export const rewriteBackend: RewriteBackend =
  import.meta.env["VITE_REWRITE_BACKEND"] === "n8n" ? "n8n" : "mock";

export const rewriteService: RewriteService =
  rewriteBackend === "n8n" ? createRemoteRewriteService() : createMockRewriteService();

export const historyService: HistoryService = remote
  ? createRemoteHistoryService()
  : createMockHistoryService();

export const savedPhraseService: SavedPhraseService = remote
  ? createRemoteSavedPhraseService()
  : createMockSavedPhraseService();

export const feedbackService: FeedbackService = remote
  ? createRemoteFeedbackService()
  : createMockFeedbackService();

export const storedDataService: StoredDataService = remote
  ? createRemoteStoredDataService()
  : createMockStoredDataService();
