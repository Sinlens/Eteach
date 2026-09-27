import type { TranslationRecord } from "@/contracts/translation";

/**
 * Translation history port (manual §5.6, §22 `GET /api/translations`).
 */
export interface HistoryService {
  /** Newest first. */
  list(limit?: number): Promise<TranslationRecord[]>;
  record(entry: TranslationRecord): Promise<void>;
  clear(): Promise<void>;
}
