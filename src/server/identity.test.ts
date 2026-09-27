import { describe, expect, it } from "vitest";

import {
  DEVICE_KEY_COOKIE,
  createMemoryCookieStore,
  ensureDeviceKey,
  resetDeviceKey,
} from "./identity";

describe("ensureDeviceKey", () => {
  it("issues a key the first time and sets it on the response", () => {
    const store = createMemoryCookieStore();

    const key = ensureDeviceKey(store);

    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.read(DEVICE_KEY_COOKIE)).toBe(key);
  });

  it("returns the same key on later calls", () => {
    const store = createMemoryCookieStore();

    expect(ensureDeviceKey(store)).toBe(ensureDeviceKey(store));
  });

  it("keeps a key the request already carried", () => {
    const existing = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    const store = createMemoryCookieStore({ [DEVICE_KEY_COOKIE]: existing });

    expect(ensureDeviceKey(store)).toBe(existing);
  });

  // The cookie is httpOnly, which stops a page script from writing it. It does
  // not stop a client from sending whatever it likes, so the value is checked
  // rather than trusted on the way in.
  it("replaces a cookie value that is not a UUID", () => {
    const store = createMemoryCookieStore({ [DEVICE_KEY_COOKIE]: "'; drop table --" });

    const key = ensureDeviceKey(store);

    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.read(DEVICE_KEY_COOKIE)).toBe(key);
  });
});

describe("resetDeviceKey", () => {
  /**
   * This belongs to the delete path. Removing somebody's rows while their
   * browser keeps sending the key those rows were filed under is half a delete:
   * the next request rebuilds a profile against the same key.
   */
  it("issues a key that is not the one the request carried", () => {
    const existing = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    const store = createMemoryCookieStore({ [DEVICE_KEY_COOKIE]: existing });

    const key = resetDeviceKey(store);

    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(key).not.toBe(existing);
    expect(store.read(DEVICE_KEY_COOKIE)).toBe(key);
  });

  it("issues a key even when the request carried none", () => {
    const store = createMemoryCookieStore();

    const key = resetDeviceKey(store);

    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.read(DEVICE_KEY_COOKIE)).toBe(key);
  });
});
