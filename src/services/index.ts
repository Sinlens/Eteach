import type { FeedbackService } from "./feedback-service";
import type { HistoryService } from "./history-service";
import { createMockFeedbackService } from "./mock/mock-feedback-service";
import { createMockHistoryService } from "./mock/mock-history-service";
import { createMockRewriteService } from "./mock/mock-rewrite-service";
import { createMockSavedPhraseService } from "./mock/mock-saved-phrase-service";
import {
  createRemoteFeedbackService,
  createRemoteHistoryService,
  createRemoteSavedPhraseService,
} from "./remote/remote-services";
import type { RewriteService } from "./rewrite-service";
import type { SavedPhraseService } from "./saved-phrase-service";

export * from "./feedback-service";
export * from "./history-service";
export * from "./rewrite-service";
export * from "./saved-phrase-service";
export { createMockRewriteService } from "./mock/mock-rewrite-service";
export type { MockRewriteServiceOptions } from "./mock/mock-rewrite-service";
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
 *
 * The rewrite itself stays mocked either way — the model belongs to the n8n
 * phase, not to this one.
 */
export type DataBackend = "mock" | "supabase";

export const dataBackend: DataBackend =
  import.meta.env["VITE_DATA_BACKEND"] === "supabase" ? "supabase" : "mock";

const remote = dataBackend === "supabase";

export const rewriteService: RewriteService = createMockRewriteService();

export const historyService: HistoryService = remote
  ? createRemoteHistoryService()
  : createMockHistoryService();

export const savedPhraseService: SavedPhraseService = remote
  ? createRemoteSavedPhraseService()
  : createMockSavedPhraseService();

export const feedbackService: FeedbackService = remote
  ? createRemoteFeedbackService()
  : createMockFeedbackService();
