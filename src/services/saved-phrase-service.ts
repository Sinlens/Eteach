import type { SavedPhrase } from "@/contracts/saved-phrase";

/**
 * Phrase library port (manual §5.5, §22 `POST /api/phrases/save`).
 */
export interface SavedPhraseService {
  /** Newest first. */
  list(): Promise<SavedPhrase[]>;
  /** Upsert by id, so saving the same phrase twice is idempotent. */
  save(phrase: SavedPhrase): Promise<void>;
  remove(id: string): Promise<void>;
}
