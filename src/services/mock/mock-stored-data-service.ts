import { createLocalKeyValueStore, resetAnonymousId, type KeyValueStore } from "@/lib/anonymous-id";
import {
  clearBrowserContent,
  createBrowserContentStores,
  type BrowserContentStores,
} from "@/services/browser-content";
import type { StoredDataService } from "@/services/stored-data-service";

type MockStoredDataOptions = {
  stores?: BrowserContentStores;
  identity?: KeyValueStore;
};

/**
 * In `mock` mode the browser is the database, so deleting everything is exactly
 * emptying what this browser holds and issuing a new identity.
 *
 * The same two steps run in `supabase` mode after the server has answered —
 * `clearBrowserContent` is shared rather than duplicated, because a store this
 * forgets is a store that survives a delete somebody was told had happened.
 */
export function createMockStoredDataService(
  options: MockStoredDataOptions = {},
): StoredDataService {
  const stores = options.stores ?? createBrowserContentStores();
  const identity = options.identity ?? createLocalKeyValueStore();

  return {
    async deleteEverything(): Promise<void> {
      clearBrowserContent(stores);
      resetAnonymousId(identity);
    },
  };
}
