import { getCookie, setCookie } from "@tanstack/react-start/server";

/**
 * Server-side identity.
 *
 * `src/lib/anonymous-id.ts` is the browser's own identity and belongs to `mock`
 * mode, where the browser is the database. This is the other one: in `supabase`
 * mode the key that fills `profiles.anonymous_key` is issued by the server and
 * travels in a cookie the page cannot read.
 *
 * That difference is the point. A key the client sends in a request payload is
 * a claim — the schema in front of it can check its shape and never its
 * ownership. A cookie the server sets is not something a caller chooses.
 */
export type CookieStore = {
  read(name: string): string | undefined;
  write(name: string, value: string): void;
};

export const DEVICE_KEY_COOKIE = "pec.device.v1";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Browsers cap a persistent cookie at 400 days, so asking for more is asking for that. */
const MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

export function createRequestCookieStore(): CookieStore {
  return {
    read: (name) => getCookie(name),
    write(name, value) {
      setCookie(name, value, {
        httpOnly: true,
        path: "/",
        maxAge: MAX_AGE_SECONDS,

        // `lax` rather than `strict` on purpose. A magic link is opened from a
        // mail client, which makes the callback a cross-site top-level
        // navigation — under `strict` the cookie would not be sent with it, and
        // the request that has to recognise the device would arrive anonymous.
        sameSite: "lax",

        // Dev serves plain http, and a `secure` cookie there is a cookie the
        // browser drops without saying so.
        secure: import.meta.env["PROD"] === true,
      });
    },
  };
}

export function createMemoryCookieStore(initial: Record<string, string> = {}): CookieStore {
  const data = new Map(Object.entries(initial));

  return {
    read: (name) => data.get(name),
    write: (name, value) => {
      data.set(name, value);
    },
  };
}

/**
 * The identity behind every request, created on first contact.
 *
 * A value that is not a UUID is treated as absent rather than passed on. The
 * cookie is `httpOnly`, so a page script cannot write it — but nothing stops a
 * client from sending whatever it likes, and this key reaches `ensure_profile`.
 */
export function ensureDeviceKey(store: CookieStore = createRequestCookieStore()): string {
  const existing = store.read(DEVICE_KEY_COOKIE);
  if (existing !== undefined && UUID_PATTERN.test(existing)) return existing;

  const created = crypto.randomUUID();
  store.write(DEVICE_KEY_COOKIE, created);
  return created;
}

/**
 * Issues a new identity, discarding the current one.
 *
 * This belongs to the delete path. Removing somebody's rows while their browser
 * keeps sending the key those rows were filed under is half a delete — the
 * identifier survives, and the next request rebuilds a profile against it.
 */
export function resetDeviceKey(store: CookieStore = createRequestCookieStore()): string {
  const created = crypto.randomUUID();
  store.write(DEVICE_KEY_COOKIE, created);
  return created;
}
