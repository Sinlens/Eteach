import type { PGlite } from "@electric-sql/pglite";
import { describe, expect } from "vitest";

import { insertProfile, insertTranslation, test } from "./test-support";

/**
 * The pending sign-in.
 *
 * A clickable link completes wherever it is opened, which is rarely where it
 * was asked for — somebody reading mail on a phone signs in there while the
 * history worth keeping sits on the laptop. Requesting a link records which
 * device asked, so the merge can follow the request rather than the click.
 */
async function startSignIn(
  db: PGlite,
  profileId: string,
  email = "someone@example.com",
  ttlMinutes = 15,
): Promise<string> {
  const { rows } = await db.query<{ start_sign_in: string }>(
    "select start_sign_in($1, $2, $3) as start_sign_in",
    [profileId, email, ttlMinutes],
  );

  const id = rows[0]?.start_sign_in;
  if (!id) throw new Error("pending sign-in was not created");
  return id;
}

async function completeSignIn(
  db: PGlite,
  pendingId: string,
  userId: string,
  email = "someone@example.com",
): Promise<string> {
  const { rows } = await db.query<{ complete_sign_in: string }>(
    "select complete_sign_in($1, $2, $3) as complete_sign_in",
    [pendingId, email, userId],
  );

  const id = rows[0]?.complete_sign_in;
  if (!id) throw new Error("sign-in did not return a profile");
  return id;
}

async function createUser(db: PGlite, email = "someone@example.com"): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "insert into users (email) values ($1) returning id",
    [email],
  );

  const id = rows[0]?.id;
  if (!id) throw new Error("user was not created");
  return id;
}

/** Somebody who has signed in before, so their account already has a profile. */
async function accountProfile(
  db: PGlite,
  email = "someone@example.com",
): Promise<{ userId: string; profileId: string }> {
  const userId = await createUser(db, email);
  const { rows } = await db.query<{ id: string }>(
    "insert into profiles (anonymous_key, user_id) values ($1, $2) returning id",
    [`account_${email}`, userId],
  );

  const profileId = rows[0]?.id;
  if (!profileId) throw new Error("account profile was not created");
  return { userId, profileId };
}

async function countPending(db: PGlite, profileId: string): Promise<number> {
  const { rows } = await db.query<{ count: number }>(
    "select count(*)::int as count from pending_sign_ins where profile_id = $1",
    [profileId],
  );

  return rows[0]?.count ?? 0;
}

async function countTranslations(db: PGlite, profileId: string): Promise<number> {
  const { rows } = await db.query<{ count: number }>(
    "select count(*)::int as count from translations where profile_id = $1",
    [profileId],
  );

  return rows[0]?.count ?? 0;
}

describe("start_sign_in", () => {
  test("records which device asked", async ({ db }) => {
    const device = await insertProfile(db, "laptop");

    const pendingId = await startSignIn(db, device);

    const { rows } = await db.query<{ profile_id: string; email: string }>(
      "select profile_id, email from pending_sign_ins where id = $1",
      [pendingId],
    );

    expect(rows[0]?.profile_id).toBe(device);
    expect(rows[0]?.email).toBe("someone@example.com");
  });

  // The newest link is the one the person is about to use. Leaving the earlier
  // ones open would also let a device accumulate rows holding an email address.
  test("replaces an earlier request from the same device", async ({ db }) => {
    const device = await insertProfile(db, "laptop");

    await startSignIn(db, device);
    await startSignIn(db, device);

    expect(await countPending(db, device)).toBe(1);
  });
});

describe("complete_sign_in", () => {
  /**
   * The first sign-in of all. There is no account profile to merge into, and
   * creating a fresh one would strand everything collected before the account
   * existed — so the profile already in front of the person becomes it. This is
   * what the initial schema meant by attaching a `user_id` to the existing row.
   */
  test("promotes the device profile when the account has none yet", async ({ db }) => {
    const laptop = await insertProfile(db, "laptop");
    const userId = await createUser(db);
    await insertTranslation(db, laptop, "rw_laptop");

    const pendingId = await startSignIn(db, laptop);
    const survivor = await completeSignIn(db, pendingId, userId);

    expect(survivor).toBe(laptop);
    expect(await countTranslations(db, laptop)).toBe(1);

    const { rows } = await db.query<{ user_id: string }>(
      "select user_id from profiles where id = $1",
      [laptop],
    );

    expect(rows[0]?.user_id).toBe(userId);
  });

  test("merges the device that asked, not the one that opened the link", async ({ db }) => {
    const laptop = await insertProfile(db, "laptop");
    const account = await accountProfile(db);
    await insertTranslation(db, laptop, "rw_laptop");

    const pendingId = await startSignIn(db, laptop);
    const survivor = await completeSignIn(db, pendingId, account.userId);

    expect(survivor).toBe(account.profileId);
    expect(await countTranslations(db, account.profileId)).toBe(1);
  });

  /**
   * `merge_profile` deletes the donor, and this row hangs off it with
   * `on delete cascade`. Without being carried across, the record marking this
   * sign-in finished is destroyed by the merge it just performed — and the
   * device still waiting on it would wait forever.
   */
  test("keeps the record after the merge that deletes the donor", async ({ db }) => {
    const laptop = await insertProfile(db, "laptop");
    const account = await accountProfile(db);

    const pendingId = await startSignIn(db, laptop);
    await completeSignIn(db, pendingId, account.userId);

    const { rows } = await db.query<{ completed_at: Date | null; profile_id: string }>(
      "select completed_at, profile_id from pending_sign_ins where id = $1",
      [pendingId],
    );

    expect(rows[0]?.completed_at).not.toBeNull();
    expect(rows[0]?.profile_id).toBe(account.profileId);
  });

  /**
   * Signing in again on the device that already holds the account asks to fold
   * a profile into itself, which `merge_profile` refuses outright because
   * `on delete cascade` would empty it. There is nothing to merge, so nothing
   * is merged — the sign-in still completes.
   */
  test("completes without merging on the device that already holds the account", async ({ db }) => {
    const account = await accountProfile(db);
    const pendingId = await startSignIn(db, account.profileId);

    const survivor = await completeSignIn(db, pendingId, account.userId);

    expect(survivor).toBe(account.profileId);

    const { rows } = await db.query<{ completed_at: Date | null }>(
      "select completed_at from pending_sign_ins where id = $1",
      [pendingId],
    );

    expect(rows[0]?.completed_at).not.toBeNull();
  });

  /**
   * A shared machine where somebody else is signed in. Their profile holds
   * their `user_id`, so it is neither an anonymous donor to merge nor a profile
   * to promote — none of what is on it belongs to whoever is signing in now.
   */
  test("leaves another account's data alone on a shared device", async ({ db }) => {
    const theirs = await accountProfile(db, "them@example.com");
    const mine = await createUser(db, "me@example.com");
    await insertTranslation(db, theirs.profileId, "rw_theirs");

    const pendingId = await startSignIn(db, theirs.profileId, "me@example.com");
    const survivor = await completeSignIn(db, pendingId, mine, "me@example.com");

    expect(survivor).not.toBe(theirs.profileId);
    expect(await countTranslations(db, theirs.profileId)).toBe(1);
    expect(await countTranslations(db, survivor)).toBe(0);
  });

  test("gives a signer with no profile one of their own on a shared device", async ({ db }) => {
    const theirs = await accountProfile(db, "them@example.com");
    const mine = await createUser(db, "me@example.com");

    const pendingId = await startSignIn(db, theirs.profileId, "me@example.com");
    const survivor = await completeSignIn(db, pendingId, mine, "me@example.com");

    const { rows } = await db.query<{ user_id: string }>(
      "select user_id from profiles where id = $1",
      [survivor],
    );

    expect(rows[0]?.user_id).toBe(mine);
  });

  test("returns the same profile when that account signed in here before", async ({ db }) => {
    const account = await accountProfile(db);
    const laptop = await insertProfile(db, "laptop");

    const pendingId = await startSignIn(db, laptop);
    const survivor = await completeSignIn(db, pendingId, account.userId);

    expect(survivor).toBe(account.profileId);
  });

  /**
   * Somebody who steals a pending reference could otherwise sign in with their
   * own address and carry the reference of a device that is not theirs,
   * folding a stranger's history into their account.
   */
  test("refuses an address other than the one that asked", async ({ db }) => {
    const laptop = await insertProfile(db, "laptop");
    const attacker = await createUser(db, "attacker@example.com");
    const pendingId = await startSignIn(db, laptop, "victim@example.com");

    await expect(completeSignIn(db, pendingId, attacker, "attacker@example.com")).rejects.toThrow();
  });

  test("refuses a reference that has expired", async ({ db }) => {
    const laptop = await insertProfile(db, "laptop");
    const userId = await createUser(db);
    const pendingId = await startSignIn(db, laptop, "someone@example.com", -1);

    await expect(completeSignIn(db, pendingId, userId)).rejects.toThrow();
  });

  test("refuses a reference that was already used", async ({ db }) => {
    const laptop = await insertProfile(db, "laptop");
    const userId = await createUser(db);
    const pendingId = await startSignIn(db, laptop);
    await completeSignIn(db, pendingId, userId);

    await expect(completeSignIn(db, pendingId, userId)).rejects.toThrow();
  });

  test("refuses a reference nobody issued", async ({ db }) => {
    const userId = await createUser(db);

    await expect(
      completeSignIn(db, "00000000-0000-4000-8000-000000000000", userId),
    ).rejects.toThrow();
  });
});
