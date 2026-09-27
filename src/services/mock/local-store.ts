import { z } from "zod";

/**
 * Storage behind the mock adapters, kept behind an interface so tests can run
 * against memory instead of a browser API.
 */
export type CollectionStore<T> = {
  read(): T[];
  write(items: readonly T[]): void;
};

/**
 * Browser-storage backing. Two rules keep it safe:
 *  - it is a no-op during SSR and whenever storage is unavailable (private
 *    mode, blocked cookies, quota), so it can never break a render;
 *  - everything read back is validated, so stale entries written by an older
 *    shape are dropped instead of reaching the UI.
 *
 * Storage is per-browser and not user-scoped. Phase 2 replaces it with the
 * database, where rows are keyed by `user_id`.
 */
export function createLocalCollectionStore<T>(
  key: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): CollectionStore<T> {
  return {
    read() {
      if (typeof window === "undefined") return [];

      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return [];

        const parsed = z.array(schema).safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : [];
      } catch {
        return [];
      }
    },
    write(items) {
      if (typeof window === "undefined") return;

      try {
        window.localStorage.setItem(key, JSON.stringify(items));
      } catch {
        // Storage can be full or blocked; losing mock persistence is acceptable.
      }
    },
  };
}

export function createMemoryCollectionStore<T>(initial: readonly T[] = []): CollectionStore<T> {
  let items: T[] = [...initial];

  return {
    read() {
      return [...items];
    },
    write(next) {
      items = [...next];
    },
  };
}
