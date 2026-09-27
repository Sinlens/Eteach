import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createLocalCollectionStore, createMemoryCollectionStore } from "./local-store";

const itemSchema = z.object({ id: z.string().min(1), label: z.string().min(1) });
type Item = z.infer<typeof itemSchema>;

const KEY = "test.items";

function stubWindow(initial: Record<string, string> = {}): void {
  const data = new Map(Object.entries(initial));

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string): string | null => data.get(key) ?? null,
        setItem: (key: string, value: string): void => {
          data.set(key, value);
        },
      },
    },
  });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("createLocalCollectionStore", () => {
  it("reads empty during SSR, when there is no window at all", () => {
    const store = createLocalCollectionStore<Item>(KEY, itemSchema);

    expect(store.read()).toEqual([]);
  });

  it("does not throw when writing during SSR", () => {
    const store = createLocalCollectionStore<Item>(KEY, itemSchema);

    expect(() => store.write([{ id: "1", label: "one" }])).not.toThrow();
  });

  it("round-trips items through storage", () => {
    stubWindow();
    const store = createLocalCollectionStore<Item>(KEY, itemSchema);

    store.write([{ id: "1", label: "one" }]);

    expect(store.read()).toEqual([{ id: "1", label: "one" }]);
  });

  it("returns empty when the key was never written", () => {
    stubWindow();

    expect(createLocalCollectionStore<Item>(KEY, itemSchema).read()).toEqual([]);
  });

  // Stale or hand-edited storage must never reach the UI.
  it("drops corrupted JSON instead of throwing", () => {
    stubWindow({ [KEY]: "{ not json" });

    expect(createLocalCollectionStore<Item>(KEY, itemSchema).read()).toEqual([]);
  });

  it("drops entries written by an older shape", () => {
    stubWindow({ [KEY]: JSON.stringify([{ id: "1" }]) });

    expect(createLocalCollectionStore<Item>(KEY, itemSchema).read()).toEqual([]);
  });
});

describe("createMemoryCollectionStore", () => {
  it("does not expose its internal array to callers", () => {
    const store = createMemoryCollectionStore<Item>([{ id: "1", label: "one" }]);

    store.read().push({ id: "2", label: "two" });

    expect(store.read()).toHaveLength(1);
  });
});
