import { describe, expect, it } from "vitest";

import {
  ANONYMOUS_ID_STORAGE_KEY,
  createMemoryKeyValueStore,
  ensureAnonymousId,
} from "./anonymous-id";

describe("ensureAnonymousId", () => {
  it("generates and stores an id the first time", () => {
    const store = createMemoryKeyValueStore();

    const id = ensureAnonymousId(store);

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.read(ANONYMOUS_ID_STORAGE_KEY)).toBe(id);
  });

  it("returns the same id on later calls", () => {
    const store = createMemoryKeyValueStore();

    expect(ensureAnonymousId(store)).toBe(ensureAnonymousId(store));
  });

  it("keeps an id that was already stored", () => {
    const existing = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    const store = createMemoryKeyValueStore({ [ANONYMOUS_ID_STORAGE_KEY]: existing });

    expect(ensureAnonymousId(store)).toBe(existing);
  });

  // Browser storage is editable by anyone at the machine.
  it("replaces a stored value that is not a UUID", () => {
    const store = createMemoryKeyValueStore({ [ANONYMOUS_ID_STORAGE_KEY]: "'; drop table --" });

    const id = ensureAnonymousId(store);

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.read(ANONYMOUS_ID_STORAGE_KEY)).toBe(id);
  });

  it("gives different devices different ids", () => {
    expect(ensureAnonymousId(createMemoryKeyValueStore())).not.toBe(
      ensureAnonymousId(createMemoryKeyValueStore()),
    );
  });
});
