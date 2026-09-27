export type KeyValueStore = {
  read(key: string): string | null;
  write(key: string, value: string): void;
};

export const ANONYMOUS_ID_STORAGE_KEY = "pec.anonymous-id.v1";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createLocalKeyValueStore(): KeyValueStore {
  return {
    read(key) {
      if (typeof window === "undefined") return null;
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    write(key, value) {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Storage can be blocked; the id simply will not survive a reload.
      }
    },
  };
}

export function createMemoryKeyValueStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = new Map(Object.entries(initial));

  return {
    read: (key) => data.get(key) ?? null,
    write: (key, value) => {
      data.set(key, value);
    },
  };
}

/**
 * The identity every stored row hangs off until auth exists.
 *
 * It is generated on the device and sent with each request; the server turns it
 * into a `profiles` row. When an auth provider is added, signing in attaches a
 * `user_id` to that same row and nothing already collected is orphaned.
 *
 * A stored value that is not a UUID is treated as absent rather than trusted —
 * browser storage is editable by anyone sitting at the machine.
 */
export function ensureAnonymousId(store: KeyValueStore = createLocalKeyValueStore()): string {
  const existing = store.read(ANONYMOUS_ID_STORAGE_KEY);
  if (existing !== null && UUID_PATTERN.test(existing)) return existing;

  const created = crypto.randomUUID();
  store.write(ANONYMOUS_ID_STORAGE_KEY, created);
  return created;
}
